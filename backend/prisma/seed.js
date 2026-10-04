// Seed the database with a demo organization, demo user, and minimal data so
// the smoke tests in CI can log in and exercise the API.
const bcrypt = require("bcryptjs");
const { prisma } = require("../config/postgres");

const DEMO_EMAIL = "demo@salesforge.com";
const DEMO_PASSWORD = "Demo1234!";
const ADMIN_EMAIL = "realvetran@gmail.com";

const main = async () => {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // Demo organization
  const org = await prisma.organization.upsert({
    where: { slug: "salesforge-demo" },
    update: {},
    create: {
      name: "SalesForge Demo",
      slug: "salesforge-demo",
      website: "https://salesforge.com",
      region: "Global",
      type: "SaaS",
      contactName: "Demo User",
      contactEmail: DEMO_EMAIL,
      plan: "PRO",
      status: "ACTIVE",
    },
  });
  console.log(`Demo org: ${org.id}`);

  // Demo user
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { password: passwordHash, organizationId: org.id, isVerified: true },
    create: {
      name: "Demo User",
      email: DEMO_EMAIL,
      password: passwordHash,
      role: "OWNER",
      organizationId: org.id,
      isVerified: true,
    },
  });
  console.log(`Demo user: ${demoUser.id}`);

  // Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { password: passwordHash, organizationId: org.id, isVerified: true, role: "ADMIN" },
    create: {
      name: "Rajat Kumar",
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: "ADMIN",
      organizationId: org.id,
      isVerified: true,
    },
  });
  console.log(`Admin user: ${adminUser.id}`);

  // A few tags, leads, and a deal to keep the UI populated
  await prisma.tag.upsert({
    where: { id: 1 },
    update: {},
    create: { name: "Hot Lead", color: "#ef4444", orgId: org.id },
  }).catch(() => null);
  await prisma.tag.upsert({
    where: { id: 2 },
    update: {},
    create: { name: "Follow Up", color: "#f59e0b", orgId: org.id },
  }).catch(() => null);

  const leadCount = await prisma.lead.count({ where: { orgId: org.id } });
  if (leadCount === 0) {
    await prisma.lead.create({
      data: {
        orgId: org.id,
        name: "Acme Corp",
        email: "contact@acme.com",
        companyName: "Acme Corp",
        jobTitle: "CTO",
        status: "qualified",
        source: "other",
        score: 75,
        addedById: demoUser.id,
      },
    });
    await prisma.lead.create({
      data: {
        orgId: org.id,
        name: "Globex Inc",
        email: "hello@globex.com",
        companyName: "Globex Inc",
        jobTitle: "VP Sales",
        status: "new",
        source: "referral",
        score: 40,
        addedById: demoUser.id,
      },
    });
    console.log("Seeded 2 leads");
  }

  console.log("Seed complete");
};

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
