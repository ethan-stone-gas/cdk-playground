// Configuration
const CONCURRENT_REQUESTS = 20; // Number of concurrent requests
const MAX_REQUESTS = 10000; // Optional: limit total number of requests

async function makeRequest(url: string, apiKey: string, requestId: number) {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    console.log(`Request ${requestId}:`, {
      status: response.status,
      remaining: response.headers.get("X-RateLimit-Remaining"),
      reset: response.headers.get("X-RateLimit-Reset"),
      resetSeconds: response.headers.get("X-RateLimit-Reset-Seconds"),
    });
  } catch (error) {
    console.error(`Request ${requestId} failed:`, error);
  }
}

async function main() {
  const url =
    "https://33s4u4imhjvmrtecpqs5bmd5me0fafnr.lambda-url.us-east-1.on.aws/api/hello";
  const apiKey = "api_key_abc";
  let requestCount = 0;

  while (requestCount < MAX_REQUESTS) {
    // Create a batch of concurrent requests
    const batch = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => {
      const requestId = requestCount + i;
      return makeRequest(url, apiKey, requestId);
    });

    // Wait for all requests in the batch to complete
    await Promise.all(batch);

    requestCount += CONCURRENT_REQUESTS;
    console.log(`Completed ${requestCount} requests so far...`);
  }
}

main().catch(console.error);
