const axios = require("axios");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { AppError } = require("../middleware/errorHandler");
const { recordAudit } = require("../services/auditService");
const { incrementUsage } = require("../services/usageService");
const aiEmailService = require("../services/aiEmailService");
const aiHealth = require("../utils/aiHealthCheck");

const recommend = asyncHandler(async (req, res) => {
  const aiURL = process.env.AI_URL;
  if (!aiURL) throw new AppError("AI service is not configured.", 503);
  try {
    const result = await axios.post(`${aiURL}/recommend`, req.body, { timeout: 10_000 });
    await recordAudit({ userId: req.user.id, orgId: req.orgId, action: "ai.recommend", entityType: "AI" });
    return response.success(res, result.data);
  } catch (error) {
    if (error.response) return response.error(res, "AI service returned an error.", 502, error.response.data);
    throw new AppError("AI service is unavailable.", 503);
  }
});

const outreach = asyncHandler(async (req, res) => {
  const { name, company, purpose } = req.body;
  if (!name || !company || !purpose) throw new AppError("name, company, and purpose are required.", 400);
  const result = await aiEmailService.generateOutreachMessage({ name, company, purpose });
  await incrementUsage({ userId: req.user.id, orgId: req.orgId, resource: "aiCalls" });
  await recordAudit({ userId: req.user.id, orgId: req.orgId, action: "ai.outreach", entityType: "AI" });
  return response.success(res, result);
});

const summarize = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) throw new AppError("text is required for summarization.", 400);
  const result = await aiEmailService.summarizeContent(text);
  await incrementUsage({ userId: req.user.id, orgId: req.orgId, resource: "aiCalls" });
  await recordAudit({ userId: req.user.id, orgId: req.orgId, action: "ai.summarize", entityType: "AI" });
  return response.success(res, result);
});

const status = asyncHandler(async (req, res) => {
  const aiURL = process.env.AI_URL;
  if (!aiURL) return response.success(res, { status: "unconfigured", url: null });
  try {
    const base = aiURL.replace(/\/recommend$/, "");
    const { data } = await axios.get(`${base}/`, { timeout: 3000 });
    return response.success(res, { status: "online", url: aiURL, service: data });
  } catch {
    return response.success(res, { status: "offline", url: aiURL });
  }
});

const list = (req, res) =>
  response.success(res, {
    endpoints: [
      "POST /api/ai/recommend",
      "POST /api/ai/outreach",
      "POST /api/ai/summarize",
      "GET  /api/ai/status",
    ],
  });

module.exports = { recommend, outreach, summarize, status, list };
