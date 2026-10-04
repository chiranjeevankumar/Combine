const { createClient } = require("redis");
const IORedis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: false,
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

// BullMQ specifically requires ioredis
const bullmqConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

bullmqConnection.on("error", (err) => {
  console.error("BullMQ IORedis Error:", err);
});

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("✅ Redis Connected");
  } catch (err) {
    console.warn("⚠️ Redis unavailable. Continuing without Redis.");
  }
};

module.exports = {
  redisClient,
  bullmqConnection,
  connectRedis,
};
