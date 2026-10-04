require("dotenv").config({ path: ".env" });
const { prisma } = require("./config/postgres");
const { dispatchNotification } = require("./services/notificationService");

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No users found.");
    return;
  }
  
  console.log("Testing with user:", user.id, user.email);
  
  await dispatchNotification({
    userId: user.id,
    orgId: user.organizationId,
    type: "SYSTEM_ALERT",
    category: "system",
    message: "This is a local integration test.",
    link: "/app",
    metadata: { test: true }
  });
  
  console.log("dispatchNotification completed.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
