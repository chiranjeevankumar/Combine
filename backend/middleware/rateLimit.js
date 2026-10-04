// A simple in-memory store is enough for this app's current single-process deployment model.
const buckets = new Map();

const createRateLimiter = ({ windowMs, max, message }) => {
  return (req, res, next) => {
    // Group requests by caller IP so bursts from one client do not throttle the entire app.
    const key = req.ip || req.headers["x-forwarded-for"] || "anonymous";
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      // Resetting the bucket lazily avoids a separate cleanup timer while still bounding each window.
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      next();
      return;
    }

    if (existing.count >= max) {
      res.status(429).json({
        success: false,
        message,
        retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      });
      return;
    }

    existing.count += 1;
    next();
  };
};

module.exports = {
  createRateLimiter,
};
