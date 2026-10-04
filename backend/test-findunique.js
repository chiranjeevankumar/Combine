require("dotenv").config({ path: ".env" });
const { connectPostgres, prisma } = require("./config/postgres");

async function run() {
  await connectPostgres();
  
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: 1, orgId: 1 }
    });
    console.log("Success:", lead);
  } catch (err) {
    console.log("Error:", err.name, err.message);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
