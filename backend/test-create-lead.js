require("dotenv").config({ path: ".env" });
const { connectPostgres, prisma } = require("./config/postgres");
const leadController = require("./controllers/leadController");

async function run() {
  await connectPostgres();
  const user = await prisma.user.findFirst({ where: { organizationId: { not: null } } });
  
  if (!user) {
    console.log("No user found.");
    return;
  }
  
  console.log("Testing createLead as user:", user.email);
  
  const req = {
    user: user,
    orgId: user.organizationId,
    body: {
      name: "Test Lead 404",
      email: "test404@example.com",
    },
    ip: "127.0.0.1",
    headers: {}
  };
  
  const res = {
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      console.log("Status:", this.statusCode);
      console.log("Body:", JSON.stringify(this.body, null, 2));
    }
  };
  
  const next = (err) => {
    console.log("Next called with error:", err);
  };
  
  try {
    await leadController.createLead(req, res, next);
  } catch (err) {
    console.log("Caught error:", err);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
