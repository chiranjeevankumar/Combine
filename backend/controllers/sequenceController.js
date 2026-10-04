const { prisma } = require("../config/postgres");
const { AppError } = require("../middleware/errorHandler");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { recordAudit } = require("../services/auditService");

const list = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const where = { orgId: req.orgId };
  if (status) where.status = status;
  const items = await prisma.sequence.findMany({ where, orderBy: { updatedAt: "desc" } });
  return response.success(res, items);
});

const get = asyncHandler(async (req, res) => {
  const sequence = await prisma.sequence.findFirst({
    where: { id: Number(req.params.id), orgId: req.orgId },
    include: { enrollments: { take: 10, orderBy: { createdAt: "desc" } } },
  });
  if (!sequence) throw new AppError("Sequence not found.", 404);
  return response.success(res, sequence);
});

const create = asyncHandler(async (req, res) => {
  const { name, description, steps, status = "DRAFT" } = req.body;
  if (!name) throw new AppError("name is required.", 400);
  if (!Array.isArray(steps) || steps.length === 0) throw new AppError("steps must be a non-empty array.", 400);
  const sequence = await prisma.sequence.create({
    data: { orgId: req.orgId, userId: req.user.id, name, description: description || null, steps, status },
  });
  await recordAudit({ userId: req.user.id, orgId: req.orgId, action: "sequence.create", entityType: "Sequence", entityId: sequence.id });
  return response.created(res, sequence);
});

const update = asyncHandler(async (req, res) => {
  const data = {};
  ["name", "description", "steps", "status", "metrics"].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
  const result = await prisma.sequence.updateMany({ where: { id: Number(req.params.id), orgId: req.orgId }, data });
  if (result.count === 0) throw new AppError("Sequence not found.", 404);
  return response.success(res, { message: "Sequence updated." });
});

const remove = asyncHandler(async (req, res) => {
  const result = await prisma.sequence.deleteMany({ where: { id: Number(req.params.id), orgId: req.orgId } });
  if (result.count === 0) throw new AppError("Sequence not found.", 404);
  return response.success(res, { message: "Sequence deleted." });
});

const enroll = asyncHandler(async (req, res) => {
  const { emails = [], leadIds = [] } = req.body;
  if (!emails.length && !leadIds.length) throw new AppError("emails or leadIds is required.", 400);
  const sequence = await prisma.sequence.findFirst({ where: { id: Number(req.params.id), orgId: req.orgId } });
  if (!sequence) throw new AppError("Sequence not found.", 404);
  if (sequence.status !== "ACTIVE") throw new AppError("Only active sequences can be enrolled.", 400);

  const enrollments = [];
  for (const email of emails) {
    const e = await prisma.sequenceEnrollment.create({
      data: {
        sequenceId: sequence.id,
        email: email.toLowerCase(),
        status: "ACTIVE",
        steps: sequence.steps,
        nextRunAt: new Date(),
      },
    });
    enrollments.push(e);
  }
  for (const leadId of leadIds) {
    const lead = await prisma.lead.findFirst({ where: { id: Number(leadId), orgId: req.orgId } });
    if (!lead) continue;
    const e = await prisma.sequenceEnrollment.create({
      data: {
        sequenceId: sequence.id,
        leadId: lead.id,
        email: lead.email,
        status: "ACTIVE",
        steps: sequence.steps,
        nextRunAt: new Date(),
      },
    });
    enrollments.push(e);
  }
  return response.success(res, { enrolled: enrollments.length });
});

const metrics = asyncHandler(async (req, res) => {
  const sequence = await prisma.sequence.findFirst({ where: { id: Number(req.params.id), orgId: req.orgId } });
  if (!sequence) throw new AppError("Sequence not found.", 404);
  const [total, active, completed, replied, bounced] = await Promise.all([
    prisma.sequenceEnrollment.count({ where: { sequenceId: sequence.id } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId: sequence.id, status: "ACTIVE" } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId: sequence.id, status: "COMPLETED" } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId: sequence.id, status: "REPLIED" } }),
    prisma.sequenceEnrollment.count({ where: { sequenceId: sequence.id, status: "BOUNCED" } }),
  ]);
  return response.success(res, { total, active, completed, replied, bounced, replyRate: total > 0 ? Math.round((replied / total) * 100) : 0 });
});

module.exports = { list, get, create, update, remove, enroll, metrics };
