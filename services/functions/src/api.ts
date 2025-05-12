import { Context, MiddlewareHandler } from "hono";
import crypto from "crypto";
import { handle } from "hono/aws-lambda";
import { getRequestCountForWindow } from "./db";
import { publishMessages } from "./queue";

const lambdaId = crypto.randomUUID();

// --- Configuration ---
const RATE_LIMIT_WINDOW_SECONDS = 60; // The time window for rate limiting (e.g., 60 seconds for per-minute)
const RATE_LIMIT_MAX_REQUESTS = 10; // The maximum allowed requests within the window
const CACHE_INVALIDATION_SECONDS = 30; // How often to invalidate the cache for a specific API key and window

// --- Kinesis Configuration ---
const FLUSH_INTERVAL_SECONDS = 5; // How often to attempt to flush in-memory requests
const MAX_BATCH_SIZE = 50; // Max number of distinct API keys/windows to include in a single batch message

// --- In-Memory Cache for Aggregated Request Counts ---
// Key: entityId::windowIdentifier, Value: { count: number, lastFetchedTime: number }
const aggregatedRequestCache = new Map<
  string,
  { count: number; lastFetchedTime: number }
>();

// --- In-Memory Request Tracking for Flushing ---
// Tracks the number of requests per entityId::windowIdentifier since the last flush
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
async function getEntityIdFromToken(
  token: string
): Promise<string | undefined> {
  if (!token) {
    return undefined;
  }
  // Simple hashing for demonstration. Replace with your actual ID lookup.
  return crypto.createHash("sha256").update(token).digest("hex");
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
    const requests: RequestMessage[] = [];

    for (const [key, count] of requestsToFlush.entries()) {
      const [entityId, windowIdentifier] = key.split("::");
      if (entityId && windowIdentifier) {
        requests.push({
          entityId,
          windowIdentifier,
          count,
          timestamp: now,
        });
      }
    }

    // Clear the in-memory buffer *before* attempting to send.
    // This means if sending fails, these requests are lost.
    // A more robust approach would re-add on failure or use a different flush strategy.

    requestsToFlush.clear();
    lastFlushTime = now; // Update last flush time immediately

    try {
      await publishMessages(
        requests.map((request) => ({
          data: JSON.stringify(request),
          partitionKey: request.entityId,
        }))
      );

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

  const entityId = await getEntityIdFromToken(token);

  if (!entityId) {
    console.log("Invalid API key provided");
    c.status(401); // Unauthorized or Bad Request
    return c.text("Invalid API key");
  }

  const windowIdentifier = getCurrentWindowIdentifier();
  const cacheKey = `${entityId}::${windowIdentifier}`;

  console.log(
    `Processing request for Entity ID: ${entityId}, Window: ${windowIdentifier}`
  );

  let cachedAggregatedCount = aggregatedRequestCache.get(cacheKey);
  const now = Math.floor(Date.now() / 1000);

  if (
    !cachedAggregatedCount ||
    now - cachedAggregatedCount.lastFetchedTime >= CACHE_INVALIDATION_SECONDS
  ) {
    console.log(
      `Cache missing or stale for ${cacheKey}, fetching from DynamoDB`
    );
    try {
      const dbAggregatedCount = await getRequestCountForWindow(
        entityId,
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

  // increment the count for this request
  cachedAggregatedCount.count += 1;

  console.log(
    `Total requests in window for ${cacheKey}: ${cachedAggregatedCount.count}`
  );

  // --- Apply the Rate Limit ---
  const success = cachedAggregatedCount.count < RATE_LIMIT_MAX_REQUESTS;

  const remaining = Math.max(
    0,
    RATE_LIMIT_MAX_REQUESTS - cachedAggregatedCount.count
  );

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const timeInWindow = nowInSeconds % RATE_LIMIT_WINDOW_SECONDS; // Time elapsed within the current window
  const timeUntilReset = RATE_LIMIT_WINDOW_SECONDS - timeInWindow;

  c.header("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", (nowInSeconds + timeUntilReset).toString()); // Timestamp of next window start
  c.header("X-RateLimit-Reset-Seconds", timeUntilReset.toString());

  if (success) {
    const numRequestsToFlush = requestsToFlush.get(cacheKey) || 0;

    // Request allowed: Increment the in-memory count for flushing
    requestsToFlush.set(cacheKey, numRequestsToFlush + 1);
    console.log(
      `Request allowed for ${entityId}. New in-memory count: ${numRequestsToFlush}`
    );
    await next();
  } else {
    // Rate limited: Do NOT increment the in-memory count or proceed.
    console.log(
      `Rate limit exceeded for ${entityId}. Total requests in window: ${cachedAggregatedCount.count}`
    );
    c.status(429); // Too Many Requests
    return c.text("Rate limit exceeded");
  }
};

// --- Example Hono App (for testing) ---
import { Hono } from "hono";
import { RequestMessage } from "./message-schemas";

let app = new Hono();

// Apply the rate limit middleware to routes that require it
app.use("/api/*", rateLimitMiddleware);

app.get("/api/hello", async (c) => {
  // Simulate a slow response if needed
  // await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
  return c.text("Hello!");
});

export const main = handle(app);
