// Metrics controller - expose metrics and health endpoints.
const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const metrics = require("../utils/metrics");
const jobQueue = require("../utils/jobQueue");
const { prisma } = require("../config/postgres");

const getMetrics = asyncHandler(async (req, res) => {
  const snapshot = metrics.snapshot();
  return response.success(res, snapshot);
});

const getHealth = asyncHandler(async (req, res) => {
  const checks = {};
  let healthy = true;
  // Database check
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "up", latencyMs: Date.now() - start };
  } catch (err) {
    checks.database = { status: "down", error: err.message };
    healthy = false;
  }
  // Memory check
  const mem = process.memoryUsage();
  checks.memory = {
    status: mem.heapUsed < mem.heapTotal * 0.9 ? "ok" : "warning",
    heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
  };
  // Uptime
  checks.uptime = {
    status: "ok",
    process: `${Math.round(process.uptime())}s`,
    system: `${Math.round(require("os").uptime())}s`,
  };
  // Job queue
  checks.jobQueue = { status: "ok", ...jobQueue.getStats() };
  return response.success(res, {
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  });
});

const getQueue = asyncHandler(async (req, res) => {
  return response.success(res, jobQueue.getStats());
});

const getStatus = asyncHandler(async (req, res) => {
  return response.success(res, {
    service: "SalesForge API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get("/", getMetrics);
router.get("/health", getHealth);
router.get("/queue", getQueue);
router.get("/status", getStatus);

module.exports = router;
