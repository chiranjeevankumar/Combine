const { prisma } = require("../config/postgres");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { AppError } = require("../middleware/errorHandler");
const { recordAudit } = require("../services/auditService");
const slugify = require("../utils/slugify");
const { publish } = require("../services/webhookService");

const getAllOrganizations = asyncHandler(async (req, res) => {
  const org = await prisma.organization.findFirst({
    where: {
      id: req.orgId,
      status: { not: "CANCELED" },
    },
  });
  return response.paginated(res, org ? [org] : [], org ? 1 : 0, 1, 12);
});

const getOrganizationById = asyncHandler(async (req, res) => {
  if (Number(req.params.id) !== req.orgId) throw new AppError("Organization not found.", 404);
  const org = await prisma.organization.findFirst({
    where: {
      id: req.orgId,
      status: { not: "CANCELED" },
    },
  });
  if (!org) throw new AppError("Organization not found.", 404);
  return response.success(res, org);
});

const createOrganization = asyncHandler(async (req, res) => {
  const existing = await prisma.organization.findUnique({
    where: { id: req.orgId },
  });

  if (existing && existing.status !== "CANCELED") {
    throw new AppError(
      "You already have your organization created. Invite members instead.",
      400
    );
  }

  const allowed = ["name", "website", "region", "type", "contactName", "contactEmail", "logo"];
  const data = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) data[key] = req.body[key];
  }

  if (!data.name) {
    throw new AppError("Organization name is required.", 400);
  }

  data.slug = `${slugify(data.name)}-${req.orgId}`;
  data.status = "ACTIVE";

  const existingSlug = await prisma.organization.findUnique({
    where: { slug: data.slug },
  });

  if (existingSlug && existingSlug.id !== req.orgId) {
    throw new AppError("An organization with a similar name already exists.", 400);
  }

  const org = await prisma.organization.update({
    where: { id: req.orgId },
    data,
  });

  await recordAudit({
    userId: req.user.id,
    orgId: req.orgId,
    action: "organization.create",
    entityType: "Organization",
    entityId: org.id,
    metadata: { fields: Object.keys(data) },
  });

  return response.success(res, org);
});

const updateOrganization = asyncHandler(async (req, res) => {
  if (req.params.id !== String(req.orgId)) throw new AppError("Organization not found.", 404);
  const allowed = ["name", "website", "region", "type", "contactName", "contactEmail", "logo"];
  const data = {};
  for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key];
  if (data.name) data.slug = `${slugify(data.name)}-${req.orgId}`;
  const org = await prisma.organization.update({ where: { id: req.orgId }, data });
  await recordAudit({
    userId: req.user.id,
    orgId: req.orgId,
    action: "organization.update",
    entityType: "Organization",
    entityId: org.id,
    metadata: { fields: Object.keys(data) },
  });
  return response.success(res, org);
});

const deleteOrganization = asyncHandler(async (req, res) => {
  if (req.params.id !== String(req.orgId)) throw new AppError("Organization not found.", 404);
  if (req.user.role !== "OWNER") throw new AppError("Only owners can delete the organization.", 403);
  await prisma.organization.update({
    where: { id: req.orgId },
    data: { status: "CANCELED" },
  });
  return response.success(res, { message: "Organization canceled." });
});

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  publish,
};
