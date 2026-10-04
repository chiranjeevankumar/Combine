const { Queue, Worker } = require("bullmq");
const { bullmqConnection, redisClient } = require("../config/redis");
const axios = require("axios");

const queueName = "find-leads-queue";

const findLeadsQueue = new Queue(queueName, { connection: bullmqConnection });

const worker = new Worker(
  queueName,
  async (job) => {
    const { fastapiJobId } = job.data;
    
    // Polling interval logic
    while (true) {
      try {
        const response = await axios.get(`http://localhost:8000/scrape/${fastapiJobId}`);
        const data = response.data;

        if (data.status === "done") {
          // Job complete, store results in redisClient for retrieval
          // Use the BullMQ job.id as the key so the frontend can look it up
          await redisClient.set(
            `find-leads-result:${job.id}`,
            JSON.stringify(data.leads),
            { EX: 3600 } // Keep for 1 hour
          );
          return { status: "done", count: data.leads?.length || 0 };
        } else if (data.status === "error") {
          throw new Error(data.error || "FastAPI scraping failed");
        }

        // Still running, delay before next poll
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (err) {
        // If it's just a network error, we might want to retry, but for simplicity let's bubble it up if it persists
        throw err;
      }
    }
  },
  { connection: bullmqConnection }
);

worker.on("failed", (job, err) => {
  console.error(`FindLeads Job ${job.id} failed with error:`, err);
});

module.exports = {
  findLeadsQueue,
};
