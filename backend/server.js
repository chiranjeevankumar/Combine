const { connectRedis, redisClient } = require("./config/redis");

const path = require("path");

for (const envFile of [path.resolve(__dirname, ".env.local"), path.resolve(__dirname, ".env")]) {
  require("dotenv").config({ path: envFile });
}

const app = require("./app");
const { connectPostgres, prisma } = require("./config/postgres");
const logger = require("./utils/logger");
const jobs = require("./jobs/followupJob");
require("./queues/findLeadsQueue"); // Initialize BullMQ queue worker

// Initialize Firebase Admin for Push Notifications
require("./config/firebase");

const startServer = async (port = Number(process.env.PORT || 3000)) => {
  await connectPostgres();
  await connectRedis();
  console.log("Redis status:", redisClient.isOpen);

  const server = app.listen(port, () => {
    if (process.env.NODE_ENV !== "test") {
      logger.info("server.started", { port, env: process.env.NODE_ENV || "development" });
    }
  });

  // Kick off background work after the API is accepting requests.
  jobs.start();

  const shutdown = async (signal) => {
    logger.info("server.shutdown", { signal });
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Hard kill if shutdown stalls.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  return server;
};

if (require.main === module) {
  startServer().catch((error) => {
    logger.error("server.failed", { err: error.message });
    process.exit(1);
  });
}

module.exports = { app, startServer };
