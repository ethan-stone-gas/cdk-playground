module.exports = {
  trackCacheMisses,
};

function trackCacheMisses(req, res, context, events, done) {
  if (res.headers["x-ratelimit-cache-stale"] === "true") {
    events.emit("counter", "rate_limit_cache_miss_count", 1);
    events.emit("rate", "rate_limit_cache_miss_rate");
  }

  if (Number(res.headers["x-ratelimit-requests-flushed"]) > 0) {
    events.emit(
      "counter",
      "rate_limit_requests_flushed_count",
      Number(res.headers["x-ratelimit-requests-flushed"])
    );
    events.emit("rate", "rate_limit_requests_flushed_rate");
  }

  if (res.headers["x-ratelimit-flush-duration"]) {
    events.emit(
      "histogram",
      "rate_limit_flush_duration",
      Number(res.headers["x-ratelimit-flush-duration"])
    );
  }

  if (res.headers["x-ratelimit-cache-invalidation-duration"]) {
    events.emit(
      "histogram",
      "rate_limit_cache_invalidation_duration",
      Number(res.headers["x-ratelimit-cache-invalidation-duration"])
    );
  }

  return done();
}
