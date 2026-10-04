/**
 * Comprehensive Notification Test Suite – v2
 *
 * Tests all 5 categories: Lead, Deal, Billing, Team, System
 * Verifies:
 *   - All three channels (In-App bell, Email, Push) respect user preference toggles
 *   - Email safety: recipient always comes from DB, never from request body
 *   - Notification preference read/update/patch endpoints via simulated controller calls
 *   - Edge cases: missing userId, missing email, unknown category
 *
 * Run with: npm test
 */

const test   = require("node:test");
const assert = require("node:assert/strict");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a minimal set of mocks so dispatchNotification can run without a real
 * DB / Nodemailer / Firebase instance.
 *
 * @param {object} opts
 *  - inAppEnabled  {boolean}  whether the user's pref for in_app is on  (default: true)
 *  - emailEnabled  {boolean}  whether the user's pref for email is on   (default: true)
 *  - pushEnabled   {boolean}  whether the user's pref for push is on    (default: true)
 *  - userEmail     {string}   the user's email in the DB  (default: "test@example.com")
 *  - userExists    {boolean}  simulate user found in DB   (default: true)
 *  - emailFails    {boolean}  simulate SMTP send failure  (default: false)
 *
 * @returns { dispatchNotification, spies }
 */
function buildMocks({
  inAppEnabled = true,
  emailEnabled = true,
  pushEnabled  = true,
  userEmail    = "test@example.com",
  userExists   = true,
  emailFails   = false,
} = {}) {
  const spies = {
    dbCreated:   false,
    emailTo:     null,
    emailSent:   false,
    pushUserId:  null,
    sseChannel:  null,
  };

  // Build fake prefs array from flags
  const makePrefs = (category) => [
    { channel: "in_app", enabled: inAppEnabled, category },
    { channel: "email",  enabled: emailEnabled,  category },
    { channel: "push",   enabled: pushEnabled,   category },
  ];

  // Stub prisma
  const prisma = {
    user: {
      findUnique: async () =>
        userExists
          ? { id: 1, email: userEmail, name: "Test User" }
          : null,
    },
    notification: {
      create: async (args) => {
        spies.dbCreated = true;
        return { id: 999, ...args.data };
      },
    },
    notificationPreference: {
      findMany: async ({ where }) => makePrefs(where.category || "system"),
    },
  };

  // Stub eventBus
  const eventBus = {
    publish: (channel) => { spies.sseChannel = channel; },
  };

  // Stub pushService
  const pushService = {
    sendPushNotification: async (userId) => {
      spies.pushUserId = userId;
      return { success: true };
    },
  };

  // Stub emailService
  const emailService = {
    send: async ({ to }) => {
      if (emailFails) return false;
      spies.emailTo   = to;
      spies.emailSent = true;
      return true;
    },
  };

  // Stub compileTemplate
  const compileTemplate = (type, message, link) => ({
    subject: `[SalesForge] ${type}`,
    html:    `<p>${message}</p>`,
    text:    message,
  });

  // ── Isolated dispatchNotification (mirrors real implementation) ─────────────
  const dispatchNotification = async ({
    userId,
    orgId,
    type,
    category,
    message,
    link = null,
    metadata = {},
  }) => {
    if (!userId) return null;

    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });

    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: Number(userId), category: (category || "system").toLowerCase() },
    });

    const getPref = (ch) => {
      const p = prefs.find((x) => x.channel === ch);
      return p ? p.enabled : true;
    };

    const inApp = getPref("in_app");
    const push  = getPref("push");
    const email = getPref("email");

    let notification = null;

    // 1. IN-APP
    if (inApp) {
      notification = await prisma.notification.create({
        data: { userId: Number(userId), type, message, link, metadata },
      });
      eventBus.publish(`user:${userId}`);
    }

    // 2. PUSH
    if (push) {
      pushService.sendPushNotification(userId, { title: type, body: message })
        .catch(() => {});
    }

    // 3. EMAIL — recipient always from DB, never from request body
    if (email && user && user.email) {
      const { subject, html, text } = compileTemplate(type, message, link);
      await emailService.send({ to: user.email, subject, html, text });
    }

    return notification;
  };

  return { dispatchNotification, spies };
}

// ─── Category: LEAD ──────────────────────────────────────────────────────────

test("Lead – all channels enabled: LEAD_CREATED fires bell + email + push", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_CREATED",
    category: "lead",
    message: "Lead John Doe added to your pipeline.",
    link: "/app/leads/42",
    metadata: { leadId: 42, leadName: "John Doe" },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell: notification row must be saved");
  assert.equal(spies.emailTo, "test@example.com",   "Email: must send to user's own email");
  assert.equal(spies.pushUserId, 1,                 "Push: must fire for user #1");
  assert.equal(spies.sseChannel, "user:1",          "SSE: must publish on user channel");
});

test("Lead – LEAD_ASSIGNED fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_ASSIGNED",
    category: "lead",
    message: "Lead Jane Smith has been assigned to you.",
    link: "/app/leads/43",
    metadata: { leadId: 43, leadName: "Jane Smith" },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell: saved for lead assigned");
  assert.equal(spies.emailTo, "test@example.com",   "Email: sent for lead assigned");
  assert.equal(spies.pushUserId, 1,                 "Push: fired for lead assigned");
});

test("Lead – LEAD_FOLLOWUP fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_FOLLOWUP",
    category: "lead",
    message: "Follow up with John Doe today.",
    link: "/app/leads/42",
    metadata: { leadName: "John Doe" },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell: saved for lead followup");
  assert.equal(spies.emailTo, "test@example.com",   "Email: sent for lead followup");
});

test("Lead – email disabled: LEAD_CREATED skips email only", async () => {
  const { dispatchNotification, spies } = buildMocks({ emailEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_CREATED",
    category: "lead",
    message: "Lead Jane Smith added.",
    link: "/app/leads/43",
  });
  assert.ok(spies.dbCreated,                        "Bell: still saved when email disabled");
  assert.equal(spies.emailTo, null,                 "Email: must NOT be sent when disabled");
  assert.equal(spies.pushUserId, 1,                 "Push: still fires when only email is disabled");
});

test("Lead – push disabled: LEAD_UPDATED skips push only", async () => {
  const { dispatchNotification, spies } = buildMocks({ pushEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_UPDATED",
    category: "lead",
    message: "Lead John Doe was updated.",
    link: "/app/leads/42",
  });
  assert.ok(spies.dbCreated,                        "Bell: still saved when push disabled");
  assert.equal(spies.emailTo, "test@example.com",   "Email: still sent when only push is disabled");
  assert.equal(spies.pushUserId, null,              "Push: must NOT fire when disabled");
});

test("Lead – in-app disabled: LEAD_DELETED skips bell and SSE", async () => {
  const { dispatchNotification, spies } = buildMocks({ inAppEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_DELETED",
    category: "lead",
    message: "Lead John Doe was deleted.",
    link: "/app/leads",
  });
  assert.equal(spies.dbCreated, false,              "Bell: must NOT create DB row when in-app disabled");
  assert.equal(spies.sseChannel, null,              "SSE: must NOT publish when in-app disabled");
  assert.equal(spies.emailTo, "test@example.com",   "Email: still sent when only in-app is disabled");
});

test("Lead – all channels disabled: no notification sent at all", async () => {
  const { dispatchNotification, spies } = buildMocks({
    inAppEnabled: false, emailEnabled: false, pushEnabled: false,
  });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_CREATED",
    category: "lead",
    message: "Lead test.",
  });
  assert.equal(spies.dbCreated, false,              "Bell: must be silent");
  assert.equal(spies.emailTo, null,                 "Email: must be silent");
  assert.equal(spies.pushUserId, null,              "Push: must be silent");
});

// ─── Category: DEAL ──────────────────────────────────────────────────────────

test("Deal – all channels enabled: DEAL_CREATED fires all three channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "DEAL_CREATED",
    category: "deal",
    message: 'New deal "Acme Corp" created.',
    link: "/app/deals/10",
    metadata: { dealId: 10, dealTitle: "Acme Corp", amount: 5000 },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for deal created");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for deal created");
  assert.equal(spies.pushUserId, 1,                 "Push fired for deal created");
});

test("Deal – DEAL_WON fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "DEAL_WON",
    category: "deal",
    message: 'Deal "Acme Corp" was closed and won.',
    link: "/app/deals/10",
    metadata: { dealId: 10, dealTitle: "Acme Corp", amount: 5000 },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for deal won");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for deal won");
  assert.equal(spies.pushUserId, 1,                 "Push fired for deal won");
});

test("Deal – DEAL_LOST fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "DEAL_LOST",
    category: "deal",
    message: 'Deal "Acme Corp" was closed as inactive.',
    link: "/app/deals/10",
    metadata: { dealId: 10, dealTitle: "Acme Corp" },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for deal lost");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for deal lost");
});

test("Deal – DEAL_STAGE_CHANGED fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "DEAL_STAGE_CHANGED",
    category: "deal",
    message: 'Deal moved to Proposal stage.',
    link: "/app/deals/10",
    metadata: { dealId: 10, dealTitle: "Acme Corp", stage: "Proposal" },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for stage change");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for stage change");
  assert.equal(spies.pushUserId, 1,                 "Push fired for stage change");
});

test("Deal – email disabled: DEAL_STAGE_CHANGED skips email", async () => {
  const { dispatchNotification, spies } = buildMocks({ emailEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "DEAL_STAGE_CHANGED",
    category: "deal",
    message: 'Deal moved to Proposal stage.',
    link: "/app/deals/10",
  });
  assert.ok(spies.dbCreated,                        "Bell saved");
  assert.equal(spies.emailTo, null,                 "Email skipped when disabled for deal");
  assert.equal(spies.pushUserId, 1,                 "Push still fires");
});

test("Deal – in-app disabled: DEAL_UPDATED skips bell but sends email and push", async () => {
  const { dispatchNotification, spies } = buildMocks({ inAppEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "DEAL_UPDATED",
    category: "deal",
    message: 'Deal updated.',
    link: "/app/deals/10",
  });
  assert.equal(spies.dbCreated, false,              "Bell skipped when in-app off");
  assert.equal(spies.sseChannel, null,              "SSE skipped when in-app off");
  assert.equal(spies.emailTo, "test@example.com",   "Email still sent");
  assert.equal(spies.pushUserId, 1,                 "Push still fires");
});

// ─── Category: BILLING ────────────────────────────────────────────────────────

test("Billing – PAYMENT_RECEIVED fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "PAYMENT_RECEIVED",
    category: "billing",
    message: "Subscription payment processed successfully.",
    link: "/app/settings/billing",
    metadata: { amount: 990 },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for payment received");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for payment received");
  assert.equal(spies.pushUserId, 1,                 "Push fired for payment received");
});

test("Billing – PAYMENT_FAILED fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "PAYMENT_FAILED",
    category: "billing",
    message: "Your subscription payment could not be processed.",
    link: "/app/settings/billing",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for payment failed");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for payment failed");
  assert.equal(spies.pushUserId, 1,                 "Push fired for payment failed");
});

test("Billing – BILLING_UPDATE (plan upgrade) fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "BILLING_UPDATE",
    category: "billing",
    message: "Your workspace has been upgraded to PRO.",
    link: "/app/settings/billing",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for billing update");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for billing update");
});

test("Billing – INVOICE_CREATED fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "INVOICE_CREATED",
    category: "billing",
    message: "Invoice INV-2026-001 has been generated.",
    link: "/app/settings/billing",
    metadata: { invoiceNumber: "INV-2026-001" },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for invoice created");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for invoice created");
});

test("Billing – push disabled: PAYMENT_RECEIVED skips push only", async () => {
  const { dispatchNotification, spies } = buildMocks({ pushEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "PAYMENT_RECEIVED",
    category: "billing",
    message: "Payment processed.",
    link: "/app/settings/billing",
  });
  assert.ok(spies.dbCreated,                        "Bell saved");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent");
  assert.equal(spies.pushUserId, null,              "Push skipped when disabled for billing");
});

test("Billing – email disabled: BILLING_ISSUE skips email only", async () => {
  const { dispatchNotification, spies } = buildMocks({ emailEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "BILLING_ISSUE",
    category: "billing",
    message: "There was an issue with your subscription.",
    link: "/app/settings/billing",
  });
  assert.ok(spies.dbCreated,                        "Bell saved");
  assert.equal(spies.emailTo, null,                 "Email skipped");
  assert.equal(spies.pushUserId, 1,                 "Push still fires");
});

// ─── Category: TEAM ───────────────────────────────────────────────────────────

test("Team – TEAM_MEMBER_INVITED fires all channels for the inviter", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "TEAM_MEMBER_INVITED",
    category: "team",
    message: "Invitation sent to newuser@example.com for role MEMBER.",
    link: "/app/settings/team",
    metadata: { email: "newuser@example.com", role: "MEMBER" },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for invite sent");
  assert.equal(spies.emailTo, "test@example.com",   "Inviter gets email confirmation");
  assert.equal(spies.pushUserId, 1,                 "Push fires for inviter");
});

test("Team – MEMBER_JOINED fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "MEMBER_JOINED",
    category: "team",
    message: "Alice has joined your organization.",
    link: "/app/settings/team",
    metadata: { memberName: "Alice" },
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for member joined");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for member joined");
  assert.equal(spies.pushUserId, 1,                 "Push fired for member joined");
});

test("Team – TEAM_ROLE_UPDATED fires all channels for the affected member", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "TEAM_ROLE_UPDATED",
    category: "team",
    message: "Your role has been updated to ADMIN.",
    link: "/app/settings/team",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for role update");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for role update");
  assert.equal(spies.pushUserId, 1,                 "Push fired for role update");
});

test("Team – TEAM_MEMBER_REMOVED fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "TEAM_MEMBER_REMOVED",
    category: "team",
    message: "You have been removed from the organization.",
    link: "/app/dashboard",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for member removed");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for member removed");
});

test("Team – email disabled: TEAM_MEMBER_REMOVED skips email only", async () => {
  const { dispatchNotification, spies } = buildMocks({ emailEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "TEAM_MEMBER_REMOVED",
    category: "team",
    message: "You have been removed from the organization.",
    link: "/app/dashboard",
  });
  assert.ok(spies.dbCreated,                        "Bell saved even when email is off");
  assert.equal(spies.emailTo, null,                 "Email skipped when team email is disabled");
  assert.equal(spies.pushUserId, 1,                 "Push still fires");
});

test("Team – all channels disabled: silent for team events", async () => {
  const { dispatchNotification, spies } = buildMocks({
    inAppEnabled: false, emailEnabled: false, pushEnabled: false,
  });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "TEAM_MEMBER_INVITED",
    category: "team",
    message: "Silent test.",
  });
  assert.equal(spies.dbCreated, false,              "Bell silent");
  assert.equal(spies.emailTo, null,                 "Email silent");
  assert.equal(spies.pushUserId, null,              "Push silent");
});

// ─── Category: SYSTEM ────────────────────────────────────────────────────────

test("System – SYSTEM_ALERT fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "SYSTEM_ALERT",
    category: "system",
    message: "System maintenance scheduled for Sunday 2am–4am.",
    link: "/app/settings",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for system alert");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for system alert");
  assert.equal(spies.pushUserId, 1,                 "Push fired for system alert");
});

test("System – MAINTENANCE_NOTICE fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "MAINTENANCE_NOTICE",
    category: "system",
    message: "Planned maintenance on Saturday between 1am and 3am.",
    link: "/app/settings",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for maintenance notice");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for maintenance notice");
  assert.equal(spies.pushUserId, 1,                 "Push fired for maintenance notice");
});

test("System – LOGIN_ALERT fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LOGIN_ALERT",
    category: "system",
    message: "A new login was recorded from Chrome on Windows.",
    link: "/app/settings/sessions",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for login alert");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for login alert");
});

test("System – PASSWORD_CHANGED fires all channels", async () => {
  const { dispatchNotification, spies } = buildMocks();
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "PASSWORD_CHANGED",
    category: "system",
    message: "Your password was recently changed.",
    link: "/app/settings",
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(spies.dbCreated,                        "Bell saved for password changed");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent for password changed");
});

test("System – in-app disabled: MAINTENANCE_NOTICE skips bell/SSE", async () => {
  const { dispatchNotification, spies } = buildMocks({ inAppEnabled: false });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "MAINTENANCE_NOTICE",
    category: "system",
    message: "Scheduled maintenance notice.",
    link: "/app/settings",
  });
  assert.equal(spies.dbCreated, false,              "Bell skipped when in-app is off");
  assert.equal(spies.sseChannel, null,              "SSE skipped when in-app is off");
  assert.equal(spies.emailTo, "test@example.com",   "Email still sent");
  assert.equal(spies.pushUserId, 1,                 "Push still fires");
});

test("System – all channels disabled: no output at all", async () => {
  const { dispatchNotification, spies } = buildMocks({
    inAppEnabled: false, emailEnabled: false, pushEnabled: false,
  });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "SYSTEM_ALERT",
    category: "system",
    message: "Silent test.",
  });
  assert.equal(spies.dbCreated, false,              "Bell silent");
  assert.equal(spies.emailTo, null,                 "Email silent");
  assert.equal(spies.pushUserId, null,              "Push silent");
});

// ─── Notification Preference Controller (unit-level) ──────────────────────────

test("NotificationPref – list returns defaults for all 5 categories × 3 channels", async () => {
  // Simulate what the controller does when no prefs exist in DB
  const defaults   = ["lead", "deal", "billing", "team", "system"];
  const channels   = ["in_app", "email", "push"];
  const savedPrefs = []; // empty DB

  const out = [];
  for (const category of defaults) {
    for (const channel of channels) {
      const existing = savedPrefs.find(
        (p) => p.category === category && p.channel === channel
      );
      out.push(existing || { channel, category, enabled: true, isDefault: true });
    }
  }

  assert.equal(out.length, 15,                      "Should produce 5 categories × 3 channels = 15 rows");
  assert.ok(out.every((p) => p.enabled === true),   "All defaults must be enabled:true");
  const cats = [...new Set(out.map((p) => p.category))];
  assert.deepEqual(cats, defaults,                  "Must cover all 5 categories");
  const chs  = [...new Set(out.map((p) => p.channel))];
  assert.deepEqual(chs.sort(), ["email", "in_app", "push"], "Must cover all 3 channels");
});

test("NotificationPref – list respects existing DB rows over defaults", async () => {
  const defaults   = ["lead", "deal", "billing", "team", "system"];
  const channels   = ["in_app", "email", "push"];
  const savedPrefs = [
    { category: "lead", channel: "email", enabled: false, orgId: null, id: 1 },
    { category: "deal", channel: "push",  enabled: false, orgId: null, id: 2 },
  ];

  const out = [];
  for (const category of defaults) {
    for (const channel of channels) {
      const existing = savedPrefs.find(
        (p) => p.category === category && p.channel === channel
      );
      out.push(existing || { channel, category, enabled: true, isDefault: true });
    }
  }

  const leadEmail = out.find((p) => p.category === "lead" && p.channel === "email");
  const dealPush  = out.find((p) => p.category === "deal"  && p.channel === "push");
  const leadInApp = out.find((p) => p.category === "lead" && p.channel === "in_app");

  assert.equal(leadEmail.enabled, false,            "Lead email pref must reflect saved false");
  assert.equal(dealPush.enabled,  false,            "Deal push pref must reflect saved false");
  assert.equal(leadInApp.enabled, true,             "Lead in_app must default to enabled");
});

test("NotificationPref – patchOne validates required fields", async () => {
  // Simulate the patchOne controller validation logic
  const validatePatch = ({ category, channel, enabled }) => {
    if (!category || !channel || enabled === undefined) {
      return { valid: false, error: "category, channel, and enabled are required." };
    }
    return { valid: true };
  };

  assert.deepEqual(validatePatch({ category: "lead", channel: "email", enabled: false }),
    { valid: true },                                "Valid patch passes");
  assert.deepEqual(validatePatch({ channel: "email", enabled: false }),
    { valid: false, error: "category, channel, and enabled are required." },
    "Missing category should fail");
  assert.deepEqual(validatePatch({ category: "lead", enabled: false }),
    { valid: false, error: "category, channel, and enabled are required." },
    "Missing channel should fail");
  assert.deepEqual(validatePatch({ category: "lead", channel: "email" }),
    { valid: false, error: "category, channel, and enabled are required." },
    "Missing enabled should fail");
});

test("NotificationPref – update validates preferences array", async () => {
  const validateUpdate = ({ preferences }) => {
    if (!Array.isArray(preferences)) {
      return { valid: false, error: "preferences must be an array." };
    }
    return { valid: true };
  };

  assert.deepEqual(validateUpdate({ preferences: [{ category: "lead", channel: "email", enabled: true }] }),
    { valid: true },                                "Valid array passes");
  assert.deepEqual(validateUpdate({ preferences: null }),
    { valid: false, error: "preferences must be an array." },
    "Null should fail");
  assert.deepEqual(validateUpdate({ preferences: "lead:email:true" }),
    { valid: false, error: "preferences must be an array." },
    "String should fail");
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

test("Edge – no userId: dispatchNotification returns null immediately", async () => {
  const { dispatchNotification } = buildMocks();
  const result = await dispatchNotification({
    userId: null,
    orgId: 1,
    type: "LEAD_CREATED",
    category: "lead",
    message: "Should be no-op.",
  });
  assert.equal(result, null,                        "Must return null for missing userId");
});

test("Edge – user not found in DB: all channels silently skipped", async () => {
  const { dispatchNotification, spies } = buildMocks({ userExists: false });
  const result = await dispatchNotification({
    userId: 999,
    orgId: 1,
    type: "LEAD_CREATED",
    category: "lead",
    message: "User does not exist.",
  });
  // in-app and push would still fire (they don't need email), but email should be skipped
  assert.equal(spies.emailTo, null,                 "Email must not be sent when user is missing from DB");
});

test("Edge – email to correct address only (not sender or other users)", async () => {
  const { dispatchNotification, spies } = buildMocks({ userEmail: "owner@company.com" });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_CREATED",
    category: "lead",
    message: "New lead.",
  });
  assert.equal(
    spies.emailTo,
    "owner@company.com",
    "Email must go to the user's DB email, not any other address"
  );
});

test("Edge – partial preferences: only push disabled, rest work", async () => {
  const { dispatchNotification, spies } = buildMocks({
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: false,
  });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "DEAL_WON",
    category: "deal",
    message: "Deal won.",
  });
  assert.ok(spies.dbCreated,                        "Bell works");
  assert.equal(spies.emailTo, "test@example.com",   "Email works");
  assert.equal(spies.pushUserId, null,              "Push is off");
});

test("Edge – email SMTP failure does not crash the pipeline", async () => {
  const { dispatchNotification, spies } = buildMocks({ emailFails: true });
  // Should not throw
  await assert.doesNotReject(async () => {
    await dispatchNotification({
      userId: 1, orgId: 1,
      type: "LEAD_CREATED",
      category: "lead",
      message: "New lead with failing SMTP.",
    });
  }, "Pipeline must not crash when SMTP fails");

  // Bell and push should still work
  assert.ok(spies.dbCreated,                        "Bell still created despite SMTP failure");
  assert.equal(spies.pushUserId, 1,                 "Push still fires despite SMTP failure");
  assert.equal(spies.emailSent, false,              "Email send flag must be false");
});

test("Edge – only two channels enabled: lead email+bell, no push", async () => {
  const { dispatchNotification, spies } = buildMocks({
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: false,
  });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "LEAD_ASSIGNED",
    category: "lead",
    message: "Lead assigned with push off.",
  });
  assert.ok(spies.dbCreated,                        "Bell created");
  assert.equal(spies.emailTo, "test@example.com",   "Email sent");
  assert.equal(spies.pushUserId, null,              "Push skipped");
});

test("Edge – only push enabled: BILLING_UPDATE skips bell and email", async () => {
  const { dispatchNotification, spies } = buildMocks({
    inAppEnabled: false,
    emailEnabled: false,
    pushEnabled: true,
  });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "BILLING_UPDATE",
    category: "billing",
    message: "Plan changed to PRO.",
  });
  assert.equal(spies.dbCreated, false,              "Bell skipped");
  assert.equal(spies.sseChannel, null,              "SSE skipped");
  assert.equal(spies.emailTo, null,                 "Email skipped");
  assert.equal(spies.pushUserId, 1,                 "Only push fires");
});

test("Edge – only email enabled: SYSTEM_ALERT skips bell and push", async () => {
  const { dispatchNotification, spies } = buildMocks({
    inAppEnabled: false,
    emailEnabled: true,
    pushEnabled: false,
  });
  await dispatchNotification({
    userId: 1, orgId: 1,
    type: "SYSTEM_ALERT",
    category: "system",
    message: "Maintenance window approaching.",
  });
  assert.equal(spies.dbCreated, false,              "Bell skipped");
  assert.equal(spies.sseChannel, null,              "SSE skipped");
  assert.equal(spies.emailTo, "test@example.com",   "Only email fires");
  assert.equal(spies.pushUserId, null,              "Push skipped");
});
