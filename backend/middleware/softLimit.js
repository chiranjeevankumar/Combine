// In-memory rate tracker for per-user request counts.
// Soft limits that do not reject but log for observability.
const buckets = new Map();

const softLimit = (limit = 1000, windowMs = 60000) => (req, res, next) => {
  const key = req.user?.id ? `u:${req.user.id}` : `ip:${req.ip}`;
  const now = Date.now();
  const entry = buckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  buckets.set(key, entry);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - entry.count)));
  next();
};

const reset = () => buckets.clear();

module.exports = { softLimit, reset };
