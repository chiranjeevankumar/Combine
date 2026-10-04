// Cursor-based pagination helpers.
const encodeCursor = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const decodeCursor = (s) => {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, "base64url").toString("utf8")); } catch (_) { return null; }
};

const paginate = (req, defaultLimit = 50, maxLimit = 200) => {
  const limit = Math.min(Number(req.query.limit) || defaultLimit, maxLimit);
  const cursor = decodeCursor(req.query.cursor);
  return { limit, cursor };
};

module.exports = { encodeCursor, decodeCursor, paginate };
