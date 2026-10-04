// Simple ETag middleware for cacheable GET responses.
const { createHash } = require("crypto");

const etag = (req, res, next) => {
  if (req.method !== "GET") return next();
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    const body = JSON.stringify(data);
    const hash = createHash("md5").update(body).digest("hex");
    const tag = `W/"${hash}"`;
    res.setHeader("ETag", tag);
    if (req.headers["if-none-match"] === tag) {
      return res.status(304).end();
    }
    return originalJson(data);
  };
  next();
};

module.exports = etag;
