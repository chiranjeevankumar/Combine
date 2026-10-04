const { prisma } = require("../config/postgres");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");

const SEED = [
  { version: "2.5.0", type: "feature", title: "Deal pipelines with Kanban view", body: "Drag-and-drop deals across pipeline stages with automatic win/loss detection and weighted forecasting." },
  { version: "2.4.0", type: "feature", title: "Workflow automations", body: "Build no-code rules that respond to lead, deal, and activity events. 11 actions including email, tasks, tags, and webhooks." },
  { version: "2.3.0", type: "feature", title: "Email sequences", body: "Automated multi-step drip campaigns with reply detection and bounce handling." },
  { version: "2.2.0", type: "feature", title: "Integrations marketplace", body: "12 pre-built integrations including Slack, Gmail, Google Calendar, Zoom, Stripe, and Zapier." },
  { version: "2.1.0", type: "feature", title: "Real-time updates via SSE", body: "Live notifications, lead updates, and webhook deliveries stream instantly to your dashboard." },
  { version: "2.0.0", type: "breaking", title: "Multi-tenant SaaS architecture", body: "Complete rewrite with multi-tenancy, RBAC, billing, audit logs, API keys, and webhooks." },
];

const list = asyncHandler(async (req, res) => {
  let entries = await prisma.changelogEntry.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: 30 });
  if (entries.length === 0) {
    await prisma.changelogEntry.createMany({ data: SEED });
    entries = await prisma.changelogEntry.findMany({ where: { published: true }, orderBy: { createdAt: "desc" }, take: 30 });
  }
  return response.success(res, entries);
});

const adminCreate = asyncHandler(async (req, res) => {
  const { version, title, body, type, published } = req.body;
  if (!version || !title || !body) throw new Error("version, title, and body are required");
  const entry = await prisma.changelogEntry.create({ data: { version, title, body, type: type || "feature", published: published !== false } });
  return response.created(res, entry);
});

module.exports = { list, adminCreate, SEED };
