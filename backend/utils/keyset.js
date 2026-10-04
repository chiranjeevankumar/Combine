// Cursor-style keyset pagination for Prisma.
// Use when offset pagination is too slow on large tables.
const keyset = (req, defaultLimit = 50) => {
  const limit = Math.min(Number(req.query.limit) || defaultLimit, 200);
  const afterId = req.query.after ? Number(req.query.after) : null;
  return { limit, afterId };
};

const nextCursor = (lastItem) => (lastItem?.id ? { after: lastItem.id } : null);

module.exports = { keyset, nextCursor };
