// Outgoing webhook dispatcher + incoming endpoint.
// Replaces the half-implemented webhookRoutes.js that depended on node-fetch.
const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { AppError } = require("../middleware/errorHandler");

const verifySignature = (payload, signature, secret) => {
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
};

const incoming = asyncHandler(async (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const secret = process.env.WEBHOOK_INCOMING_SECRET;
  if (!signature || !secret) throw new AppError("Missing signature header.", 401);

  // Express body parser is JSON; we need the raw body for HMAC, so we re-serialize.
  const raw = JSON.stringify(req.body);
  if (!verifySignature(raw, signature, secret)) {
    throw new AppError("Invalid signature.", 401);
  }
  const { event, data } = req.body;
  // Hook for the rest of the system; emit a notification as a demo.
  // You can extend this with a switch(event) -> handler.
  return response.success(res, { received: true, event, at: new Date().toISOString() });
});

module.exports = { incoming };
