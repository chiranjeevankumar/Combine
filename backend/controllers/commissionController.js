// Commission tracking - sales rep earnings on closed deals.
// Commissions are stored as part of the User's customFields JSON column to
// avoid a new schema model. Each commission tracks deal attribution, amount,
// rate, period, and approval/paid status.
const { prisma } = require("../config/postgres");
const { AppError } = require("../middleware/errorHandler");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { recordAudit } = require("../services/auditService");

const list = asyncHandler(async (req, res) => {
  const { userId, status, period } = req.query;
  const where = { organizationId: req.orgId };
  if (userId) where.id = Number(userId);
  const users = await prisma.user.findMany({
    where, take: 50,
    select: { id: true, name: true, email: true, customFields: true },
  });
  const allCommissions = [];
  for (const u of users) {
    const comms = u.customFields?.commissions || [];
    for (const c of comms) {
      if (userId && u.id !== Number(userId)) continue;
      if (status && c.status !== status) continue;
      if (period && c.period !== period) continue;
      allCommissions.push({
        id: `${u.id}-${c.dealId || c.period}`,
        userId: u.id,
        user: { id: u.id, name: u.name, email: u.email },
        ...c,
      });
    }
  }
  return response.success(res, allCommissions);
});

const get = asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: Number(req.params.userId), organizationId: req.orgId } });
  if (!user) throw new AppError("User not found.", 404);
  const comms = user.customFields?.commissions || [];
  const comm = comms.find((c) => c.id === req.params.id || c.dealId === Number(req.params.id));
  if (!comm) throw new AppError("Commission not found.", 404);
  return response.success(res, { id: req.params.id, userId: user.id, user: { id: user.id, name: user.name }, ...comm });
});

const create = asyncHandler(async (req, res) => {
  const { userId, dealId, amount, rate, type = "deal", period } = req.body;
  if (!userId) throw new AppError("userId is required.", 400);
  if (amount === undefined || rate === undefined) throw new AppError("amount and rate are required.", 400);

  const user = await prisma.user.findFirst({ where: { id: Number(userId), organizationId: req.orgId } });
  if (!user) throw new AppError("User not found.", 404);

  const cf = user.customFields || {};
  const commissions = cf.commissions || [];
  const commission = {
    id: `comm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    dealId, amount: Number(amount), rate: Number(rate), type,
    period: period || new Date().toISOString().slice(0, 7),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  commissions.push(commission);
  await prisma.user.update({
    where: { id: user.id },
    data: { customFields: { ...cf, commissions } },
  });
  await recordAudit({ userId: req.user.id, orgId: req.orgId, action: "commission.create", entityType: "Commission", entityId: commission.id, metadata: { amount, rate } });
  return response.created(res, { id: commission.id, userId: user.id, ...commission });
});

const update = asyncHandler(async (req, res) => {
  const { status, paidAt, approvedAt } = req.body;
  const user = await prisma.user.findFirst({ where: { id: Number(req.params.userId), organizationId: req.orgId } });
  if (!user) throw new AppError("User not found.", 404);
  const cf = user.customFields || {};
  const commissions = cf.commissions || [];
  const idx = commissions.findIndex((c) => c.id === req.params.id);
  if (idx === -1) throw new AppError("Commission not found.", 404);
  if (status) commissions[idx].status = status;
  if (paidAt) commissions[idx].paidAt = paidAt;
  if (approvedAt) commissions[idx].approvedAt = approvedAt;
  await prisma.user.update({
    where: { id: user.id },
    data: { customFields: { ...cf, commissions } },
  });
  return response.success(res, { message: "Commission updated." });
});

const remove = asyncHandler(async (req, res) => {
  const user = await prisma.user.findFirst({ where: { id: Number(req.params.userId), organizationId: req.orgId } });
  if (!user) throw new AppError("User not found.", 404);
  const cf = user.customFields || {};
  const commissions = (cf.commissions || []).filter((c) => c.id !== req.params.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { customFields: { ...cf, commissions } },
  });
  return response.success(res, { message: "Commission removed." });
});

const metrics = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { organizationId: req.orgId },
    select: { id: true, name: true, customFields: true },
  });
  let totalPending = 0;
  let totalPaid = 0;
  let totalAmount = 0;
  const byUser = [];
  for (const u of users) {
    const comms = u.customFields?.commissions || [];
    let userPending = 0;
    let userPaid = 0;
    let userTotal = 0;
    for (const c of comms) {
      userTotal += c.amount || 0;
      totalAmount += c.amount || 0;
      if (c.status === "paid") { userPaid += c.amount || 0; totalPaid += c.amount || 0; }
      else if (c.status === "pending") { userPending += c.amount || 0; totalPending += c.amount || 0; }
    }
    byUser.push({ userId: u.id, name: u.name, pending: userPending, paid: userPaid, total: userTotal });
  }
  return response.success(res, { totalPending, totalPaid, totalAmount, byUser });
});

module.exports = { list, get, create, update, remove, metrics };
