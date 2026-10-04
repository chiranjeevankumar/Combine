require("dotenv").config({ path: ".env" });
const nodemailer = require("nodemailer");

async function main() {
  console.log("Using EMAIL_USER:", process.env.EMAIL_USER);
  console.log("Using EMAIL_PASS:", process.env.EMAIL_PASS ? "***" : "missing");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true", 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // sending to self for testing
      subject: "Test Email from SalesForge",
      text: "This is a test email to verify SMTP settings.",
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("Failed to send email:");
    console.error(error);
  }
}

main();
