// Pagination metadata helper.
const buildMeta = (total, page, limit) => ({
  total,
  page: Number(page) || 1,
  limit: Number(limit) || 50,
  pages: Math.max(1, Math.ceil(total / (Number(limit) || 50))),
  hasNext: (Number(page) || 1) * (Number(limit) || 50) < total,
  hasPrev: (Number(page) || 1) > 1,
});

module.exports = { buildMeta };
