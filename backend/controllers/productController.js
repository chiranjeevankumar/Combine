const { prisma } = require("../config/postgres");
const { AppError } = require("../middleware/errorHandler");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { recordAudit } = require("../services/auditService");
const { incrementUsage } = require("../services/usageService");

const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search, category, isActive } = req.query;
  const where = { orgId: req.orgId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.category = category;
  if (isActive !== undefined) where.isActive = isActive === "true";
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { name: "asc" }, skip, take: Number(limit) }),
    prisma.product.count({ where }),
  ]);
  return response.paginated(res, items, total, page, limit);
});

const get = asyncHandler(async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: Number(req.params.id), orgId: req.orgId } });
  if (!product) throw new AppError("Product not found.", 404);
  return response.success(res, product);
});

const create = asyncHandler(async (req, res) => {
  const { name, sku, description, category, unitPrice, cost, currency } = req.body;
  if (!name || !sku) throw new AppError("name and sku are required.", 400);
  try {
    const product = await prisma.product.create({
      data: {
        orgId: req.orgId,
        name, sku, description: description || null,
        category: category || null,
        unitPrice: Number(unitPrice) || 0,
        cost: Number(cost) || 0,
        currency: currency || "USD",
      },
    });
    await recordAudit({ userId: req.user.id, orgId: req.orgId, action: "product.create", entityType: "Product", entityId: product.id });
    return response.created(res, product);
  } catch (e) {
    if (e.code === "P2002") throw new AppError("A product with this SKU already exists.", 409);
    throw e;
  }
});

const update = asyncHandler(async (req, res) => {
  const data = {};
  ["name", "sku", "description", "category", "unitPrice", "cost", "currency", "isActive"].forEach((k) => {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  });
  const result = await prisma.product.updateMany({ where: { id: Number(req.params.id), orgId: req.orgId }, data });
  if (result.count === 0) throw new AppError("Product not found.", 404);
  return response.success(res, { message: "Product updated." });
});

const remove = asyncHandler(async (req, res) => {
  const result = await prisma.product.deleteMany({ where: { id: Number(req.params.id), orgId: req.orgId } });
  if (result.count === 0) throw new AppError("Product not found.", 404);
  return response.success(res, { message: "Product deleted." });
});

const categories = asyncHandler(async (req, res) => {
  const items = await prisma.product.groupBy({ by: ["category"], where: { orgId: req.orgId }, _count: { category: true } });
  return response.success(res, items.map((c) => ({ category: c.category, count: c._count.category })));
});

module.exports = { list, get, create, update, remove, categories };
