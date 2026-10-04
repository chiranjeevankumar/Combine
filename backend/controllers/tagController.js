const { prisma } = require("../config/postgres");
const { AppError } = require("../middleware/errorHandler");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const slugify = require("../utils/slugify");
const { incrementUsage } = require("../services/usageService");
const { enrollLeadInActiveCampaigns } = require("../services/campaignAutomationService");

const list = asyncHandler(async (req, res) => {
  const items = await prisma.tag.findMany({
    where: { orgId: req.orgId },
    orderBy: { name: "asc" },
    include: { _count: { select: { leads: true } } },
  });
  return response.success(res, items);
});

const create = asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  if (!name) throw new AppError("Tag name is required.", 400);
  const slug = slugify(name);
  try {
    const tag = await prisma.tag.create({
      data: {
        name,
        slug,
        color: color || "#3b82f6",
        orgId: req.orgId,
        userId: req.user.id,
      },
    });
    await incrementUsage({ userId: req.user.id, orgId: req.orgId, resource: "tags" });
    return response.created(res, tag);
  } catch (error) {
    if (error.code === "P2002") throw new AppError("A tag with this name already exists.", 409);
    throw error;
  }
});

const update = asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  const data = {};
  if (name !== undefined) {
    data.name = name;
    data.slug = slugify(name);
  }
  if (color !== undefined) data.color = color;
  const result = await prisma.tag.updateMany({
    where: { id: Number(req.params.id), orgId: req.orgId },
    data,
  });
  if (result.count === 0) throw new AppError("Tag not found.", 404);
  return response.success(res, { message: "Tag updated." });
});

const remove = asyncHandler(async (req, res) => {
  const result = await prisma.tag.deleteMany({
    where: { id: Number(req.params.id), orgId: req.orgId },
  });
  if (result.count === 0) throw new AppError("Tag not found.", 404);
  return response.success(res, { message: "Tag removed." });
});

const attachToLead = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const { tagId } = req.body;
  // Verify ownership in the same org.
  const lead = await prisma.lead.findFirst({ where: { id: Number(leadId), orgId: req.orgId } });
  if (!lead) throw new AppError("Lead not found.", 404);
  const tag = await prisma.tag.findFirst({ where: { id: Number(tagId), orgId: req.orgId } });
  if (!tag) throw new AppError("Tag not found.", 404);
  await prisma.leadTag.upsert({
    where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } },
    create: { leadId: lead.id, tagId: tag.id },
    update: {},
  });

// Automatically enroll the lead if this tag makes it eligible for a campaign.
await enrollLeadInActiveCampaigns(lead, req.orgId, req.user.id);
  return response.success(res, { message: "Tag attached." });
});

const detachFromLead = asyncHandler(async (req, res) => {
  const { leadId, tagId } = req.params;
  await prisma.leadTag.deleteMany({
    where: { leadId: Number(leadId), tagId: Number(tagId), lead: { orgId: req.orgId } },
  });
  return response.success(res, { message: "Tag detached." });
});

const listForLead = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const items = await prisma.leadTag.findMany({
    where: { leadId: Number(leadId), lead: { orgId: req.orgId } },
    include: { tag: true },
  });
  return response.success(res, items.map((i) => i.tag));
});

module.exports = { list, create, update, remove, attachToLead, detachFromLead, listForLead };
