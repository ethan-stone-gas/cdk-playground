module.exports = {
  trackCacheMisses,
};

function trackCacheMisses(req, res, context, events, done) {
  if (res.headers["x-rate-limit-cache-stale"] === "true") {
    events.emit("rate", "rate_limit_cache_miss");
  }
  return done();
}
