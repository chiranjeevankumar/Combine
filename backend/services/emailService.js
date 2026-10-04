/**
 * emailService.js
 *
 * Sends transactional emails via Nodemailer (SMTP).
 *
 * Configuration (all in .env):
 *   SMTP_HOST     – SMTP server hostname  (default: smtp.gmail.com)
 *   SMTP_PORT     – SMTP port             (default: 587)
 *   SMTP_SECURE   – "true" for TLS/465    (default: false → STARTTLS)
 *   EMAIL_USER    – SMTP login / sender address
 *   EMAIL_PASS    – SMTP password / app-password
 *   EMAIL_FROM    – Friendly "From" header  (default: "SalesForge Notifications <EMAIL_USER>")
 *
 * The Resend fallback has been removed; if you later want Resend set RESEND_API_KEY
 * and re-introduce it here. For now Gmail SMTP (App Password) is the active transport.
 */

const nodemailer = require("nodemailer");

let _transporter = null;

/**
 * Returns (and lazily creates) the shared Nodemailer transporter.
 * Returns null if SMTP credentials are not configured.
 */
const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   || "smtp.gmail.com",
      port:   parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true", // true → TLS (port 465), false → STARTTLS (587)
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Prevent connection pool exhaustion on slow networks
      pool:             true,
      maxConnections:   5,
      maxMessages:      100,
      rateDelta:        1000,
      rateLimit:        5,
    });
  }

  return _transporter;
};

/**
 * Sends an email using Nodemailer / SMTP.
 *
 * @param {object} opts
 * @param {string}  opts.to         – Recipient email address
 * @param {string}  opts.subject    – Email subject line
 * @param {string}  opts.html       – HTML body
 * @param {string} [opts.text]      – Plain-text fallback (recommended)
 * @returns {Promise<boolean>} true if accepted by the SMTP server, false otherwise
 */
const send = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn("[EmailService] SMTP not configured (EMAIL_USER / EMAIL_PASS missing). Skipping email to:", to);
    return false;
  }

  const from = process.env.EMAIL_FROM ||
    `"SalesForge Notifications" <${process.env.EMAIL_USER}>`;

  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || subject,
      // Reply-To avoids no-reply pattern which raises spam score
      replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER,
      headers: {
        // List-Unsubscribe is required by Gmail/Yahoo for bulk senders
        "List-Unsubscribe":      `<${frontendUrl}/notifications-prefs>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        // Unique message ID prevents deduplication false-positives
        "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });

    console.log(`[EmailService] Email sent to ${to} | messageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error("[EmailService] Failed to send email via SMTP:", err.message || err);
    return false;
  }
};

/**
 * Sends a basic notification email (backward-compatible wrapper).
 *
 * @param {string} to      – Recipient email address
 * @param {string} subject – Email subject
 * @param {string} text    – Plaintext body
 * @returns {Promise<boolean>} true if sent, false otherwise
 */
const sendNotificationEmail = async (to, subject, text) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: sans-serif; color: #333; line-height: 1.5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #17AA97;">SalesForge Notification</h2>
    <p>${text.replace(/\n/g, "<br>")}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #999;">You received this because you enabled email notifications in SalesForge.</p>
  </div>
</body>
</html>`;
  return send({ to, subject, html, text });
};

/**
 * Verifies the SMTP connection.  Useful for health-checks and startup diagnostics.
 * @returns {Promise<boolean>}
 */
const verifyConnection = async () => {
  const transporter = getTransporter();
  if (!transporter) return false;
  try {
    await transporter.verify();
    console.log("[EmailService] SMTP connection verified successfully.");
    return true;
  } catch (err) {
    console.error("[EmailService] SMTP connection verification failed:", err.message || err);
    return false;
  }
};

module.exports = {
  send,
  sendNotificationEmail,
  verifyConnection,
};
