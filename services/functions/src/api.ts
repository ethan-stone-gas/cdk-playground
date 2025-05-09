import { Context, MiddlewareHandler } from "hono";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import crypto from "crypto";
import { handle } from "hono/aws-lambda";

// Import necessary AWS SDK clients for Kinesis
import { KinesisClient, PutRecordCommand } from "@aws-sdk/client-kinesis";

// --- Configuration ---
const RATE_LIMIT_WINDOW_SECONDS = 60; // The time window for rate limiting (e.g., 60 seconds for per-minute)
const RATE_LIMIT_MAX_REQUESTS = 10; // The maximum allowed requests within the window
const CACHE_INVALIDATION_SECONDS = 30; // How often to invalidate the cache for a specific API key and window
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME; // Your DynamoDB table name

// --- Kinesis Configuration ---
const KINESIS_STREAM_NAME = process.env.KINESIS_STREAM_NAME; // Your Kinesis Stream name
const FLUSH_INTERVAL_SECONDS = 5; // How often to attempt to flush in-memory requests
const MAX_BATCH_SIZE = 50; // Max number of distinct API keys/windows to include in a single batch message

// --- AWS SDK Clients ---
const dynamodbClient = new DynamoDBClient({});
const kinesisClient = new KinesisClient({}); // Explicitly initialize KinesisClient

// --- In-Memory Cache for Aggregated Request Counts ---
// Key: apiKeyId::windowIdentifier, Value: { count: number, lastFetchedTime: number }
const aggregatedRequestCache = new Map<
  string,
  { count: number; lastFetchedTime: number }
>();

// --- In-Memory Request Tracking for Flushing ---
// Tracks the number of requests per apiKeyId::windowIdentifier since the last flush
const requestsToFlush = new Map<string, number>();
let lastFlushTime = Math.floor(Date.now() / 1000); // Track the last time a flush was attempted

// --- Helper Functions ---

/**
 * Gets the current rate limit window identifier (e.g., YYYY-MM-DD-HH-MM).
 */
function getCurrentWindowIdentifier(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = now.getUTCDate().toString().padStart(2, "0");
  const hours = now.getUTCHours().toString().padStart(2, "0");
  const minutes =
    Math.floor(now.getUTCMinutes() / (RATE_LIMIT_WINDOW_SECONDS / 60)) *
    (RATE_LIMIT_WINDOW_SECONDS / 60); // Integer minutes based on window
  const paddedMinutes = minutes.toString().padStart(2, "0");
  return `${year}-${month}-${day}-${hours}-${paddedMinutes}`;
}

/**
 * Hashes the API key (replace with your actual API key resolution logic)
 * and returns a unique identifier for the API key.
 */
async function getApiKeyIdFromToken(
  token: string
): Promise<string | undefined> {
  if (!token) {
    return undefined;
  }
  // Simple hashing for demonstration. Replace with your actual ID lookup.
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Fetches the aggregated request count for a specific window from DynamoDB.
 */
async function getAggregatedRequestCountFromDynamoDB(
  apiKeyId: string,
  windowIdentifier: string
): Promise<number> {
  try {
    const command = new GetItemCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Key: marshall({ apiKeyId, windowIdentifier }),
      ProjectionExpression: "requestCount", // Only fetch the requestCount attribute
    });
    const { Item } = await dynamodbClient.send(command);
    if (Item && Item.requestCount && Item.requestCount.N) {
      return Number(Item.requestCount.N);
    }
    return 0; // Return 0 if the item or requestCount doesn't exist
  } catch (error) {
    console.error(
      `Error fetching aggregated request count from DynamoDB for ${apiKeyId}::${windowIdentifier}:`,
      error
    );
    // Depending on your strategy, you might return 0 (allow potentially)
    // or throw an error (prevent request on DB failure). Let's return 0
    // to favor availability over strict rate limiting on DB read errors.
    return 0;
  }
}

/**
 * Attempts to flush the in-memory request counts to the Kinesis stream.
 */
async function flushRequestsToKinesisIfNecessary() {
  const now = Math.floor(Date.now() / 1000);
  const needsFlush =
    requestsToFlush.size > 0 &&
    (now - lastFlushTime >= FLUSH_INTERVAL_SECONDS ||
      requestsToFlush.size >= MAX_BATCH_SIZE); // Trigger by time or size

  if (needsFlush) {
    console.log(
      `Flushing ${requestsToFlush.size} API key/window requests to Kinesis.`
    );

    // Prepare the batch data
    const batchData: {
      apiKeyId: string;
      windowIdentifier: string;
      count: number;
    }[] = [];
    for (const [key, count] of requestsToFlush.entries()) {
      const [apiKeyId, windowIdentifier] = key.split("::");
      if (apiKeyId && windowIdentifier) {
        batchData.push({ apiKeyId, windowIdentifier, count });
      }
    }

    // Clear the in-memory buffer *before* attempting to send.
    // This means if sending fails, these requests are lost.
    // A more robust approach would re-add on failure or use a different flush strategy.
    const currentRequestsToFlush = new Map(requestsToFlush); // Copy for retries if needed
    requestsToFlush.clear();
    lastFlushTime = now; // Update last flush time immediately

    // Construct the message payload
    const messagePayload = JSON.stringify({
      timestamp: now, // Timestamp of when the batch is sent
      requests: batchData,
    });

    try {
      const command = new PutRecordCommand({
        StreamName: KINESIS_STREAM_NAME!,
        Data: Buffer.from(messagePayload),
        // Using the first apiKeyId as a partition key. A better strategy
        // for even distribution might be needed depending on traffic patterns.
        PartitionKey: batchData[0]?.apiKeyId || "default",
      });
      await kinesisClient.send(command);

      console.log("Requests successfully flushed to Kinesis.");
    } catch (error) {
      console.error("Error flushing requests to Kinesis:", error);
      // Handle errors sending to the queue. Log, alert, potentially dead-letter queue.
      // If sending fails, the requests in `currentRequestsToFlush` are lost
      // unless you implement a retry/re-add mechanism here.
    }
  }
}

// --- Hono Middleware ---
export const rateLimitMiddleware: MiddlewareHandler = async (
  c: Context,
  next
) => {
  // Attempt to flush requests before processing the current request
  await flushRequestsToKinesisIfNecessary();

  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    console.log("No API key provided in request");
    await next(); // No API key, proceed without rate limiting
    return;
  }

  const apiKeyId = await getApiKeyIdFromToken(token);

  if (!apiKeyId) {
    console.log("Invalid API key provided");
    c.status(401); // Unauthorized or Bad Request
    return c.text("Invalid API key");
  }

  const windowIdentifier = getCurrentWindowIdentifier();
  const cacheKey = `${apiKeyId}::${windowIdentifier}`;

  console.log(
    `Processing request for API Key ID: ${apiKeyId}, Window: ${windowIdentifier}`
  );

  let cachedAggregatedCount = aggregatedRequestCache.get(cacheKey);
  const now = Math.floor(Date.now() / 1000);

  const isCacheStale =
    !cachedAggregatedCount ||
    now - cachedAggregatedCount.lastFetchedTime >= CACHE_INVALIDATION_SECONDS;

  if (isCacheStale) {
    console.log(
      `Cache missing or stale for ${cacheKey}, fetching from DynamoDB`
    );
    try {
      const dbAggregatedCount = await getAggregatedRequestCountFromDynamoDB(
        apiKeyId,
        windowIdentifier
      );
      cachedAggregatedCount = {
        count: dbAggregatedCount,
        lastFetchedTime: now,
      };
      aggregatedRequestCache.set(cacheKey, cachedAggregatedCount);
      console.log(
        `Fetched aggregated count from DB for ${cacheKey}: ${cachedAggregatedCount.count}`
      );
    } catch (dbError) {
      console.error(
        `Failed to fetch aggregated count from DB for ${cacheKey}`,
        dbError
      );
      // If DB read fails, proceed with a cached count of 0 for this window.
      // This favors availability over strict rate limiting in case of DB issues.
      cachedAggregatedCount = { count: 0, lastFetchedTime: now };
      aggregatedRequestCache.set(cacheKey, cachedAggregatedCount);
    }
  } else {
    console.log(
      `Using fresh cache for ${cacheKey}. Count: ${cachedAggregatedCount?.count}`
    );
  }

  // Get the current in-memory count for this window that hasn't been flushed yet
  const inMemoryCount = requestsToFlush.get(cacheKey) || 0;

  // Calculate the total requests in the current window (fetched from DB + in-memory unflushed)
  const totalRequestsInWindow =
    (cachedAggregatedCount?.count || 0) + inMemoryCount;

  console.log(
    `Total requests in window for ${cacheKey}: ${totalRequestsInWindow} (DB: ${cachedAggregatedCount?.count}, In-Memory: ${inMemoryCount})`
  );

  // --- Apply the Rate Limit ---
  const success = totalRequestsInWindow < RATE_LIMIT_MAX_REQUESTS;

  if (success) {
    // Request allowed: Increment the in-memory count for flushing
    requestsToFlush.set(cacheKey, inMemoryCount + 1);
    console.log(
      `Request allowed for ${apiKeyId}. New in-memory count: ${requestsToFlush.get(
        cacheKey
      )}`
    );
    await next();
  } else {
    // Rate limited: Do NOT increment the in-memory count or proceed.
    console.log(
      `Rate limit exceeded for ${apiKeyId}. Total requests in window: ${totalRequestsInWindow}`
    );
    c.status(429); // Too Many Requests
    return c.text("Rate limit exceeded");
  }

  // Optional: Add rate limit headers based on the current *estimated* state.
  // These headers will be eventually consistent with DynamoDB.
  const remaining = Math.max(
    0,
    RATE_LIMIT_MAX_REQUESTS - totalRequestsInWindow
  );
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const timeInWindow = nowInSeconds % RATE_LIMIT_WINDOW_SECONDS; // Time elapsed within the current window
  const timeUntilReset = RATE_LIMIT_WINDOW_SECONDS - timeInWindow;

  c.header("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", (nowInSeconds + timeUntilReset).toString()); // Timestamp of next window start
  c.header("X-RateLimit-Reset-Seconds", timeUntilReset.toString());
};

// --- Example Hono App (for testing) ---
import { Hono } from "hono";

const app = new Hono();

// Apply the rate limit middleware to routes that require it
app.use("/api/*", rateLimitMiddleware);

app.get("/api/hello", async (c) => {
  // Simulate a slow response if needed
  // await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
  return c.text("Hello!");
});

export const main = handle(app);
