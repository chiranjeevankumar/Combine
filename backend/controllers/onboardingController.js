const { prisma } = require("../config/postgres");
const { AppError } = require("../middleware/errorHandler");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");

const DEFAULTS = [
  { step: "welcome", title: "Welcome to SalesForge", description: "Your workspace is ready." },
  { step: "first-lead", title: "Add your first lead", description: "Build your pipeline." },
  { step: "invite-team", title: "Invite your team", description: "Collaboration makes it better." },
  { step: "connect-integration", title: "Connect an integration", description: "Sync with Slack, Gmail, and more." },
  { step: "explore-ai", title: "Try AI features", description: "Let AI draft your first email." },
];

const progress = asyncHandler(async (req, res) => {
  const done = await prisma.onboardingProgress.findMany({ where: { userId: req.user.id, orgId: req.orgId } });
  const map = Object.fromEntries(done.map((d) => [d.step, d]));
  const result = DEFAULTS.map((d) => ({ ...d, completed: !!map[d.step]?.completed, completedAt: map[d.step]?.completedAt }));
  return response.success(res, { steps: result, completed: result.filter((r) => r.completed).length, total: result.length });
});

const complete = asyncHandler(async (req, res) => {
  const { step } = req.params;
  if (!DEFAULTS.find((d) => d.step === step)) throw new AppError("Unknown onboarding step.", 400);
  const result = await prisma.onboardingProgress.upsert({
    where: { userId_step: { userId: req.user.id, step } },
    create: { userId: req.user.id, orgId: req.orgId, step, completed: true, completedAt: new Date() },
    update: { completed: true, completedAt: new Date() },
  });
  return response.success(res, result);
});

const reset = asyncHandler(async (req, res) => {
  await prisma.onboardingProgress.deleteMany({ where: { userId: req.user.id, orgId: req.orgId } });
  return response.success(res, { message: "Onboarding reset." });
});

const skip = asyncHandler(async (req, res) => {
  await prisma.onboardingProgress.upsert({
    where: { userId_step: { userId: req.user.id, step: req.params.step } },
    create: { userId: req.user.id, orgId: req.orgId, step: req.params.step, completed: true, completedAt: new Date() },
    update: { completed: true, completedAt: new Date() },
  });
  return response.success(res, { message: "Step skipped." });
});

module.exports = { progress, complete, reset, skip, DEFAULTS };
