// Standardized API response helpers for a consistent shape across all endpoints.
const success = (res, data = null, meta = null, status = 200) => {
  const body = { success: true };
  if (data !== null && data !== undefined) body.data = data;
  if (meta !== null && meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
};

const created = (res, data = null, meta = null) => success(res, data, meta, 201);
const noContent = (res) => res.status(204).send();

const error = (res, message, status = 400, details = null, code = null) => {
  const body = { success: false, message };
  if (details) body.details = details;
  if (code) body.code = code;
  return res.status(status).json(body);
};

const paginated = (res, items, total, page, limit) => {
  return res.json({
    success: true,
    data: items,
    meta: {
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.max(1, Math.ceil(total / Number(limit))),
        hasMore: Number(page) * Number(limit) < total,
      },
    },
  });
};

module.exports = { success, created, noContent, error, paginated };
