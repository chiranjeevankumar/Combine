// Background jobs. All time-based work runs in a single scheduler with safety guards
// so a slow iteration never overlaps the next one.
const cron = require("node-cron");
const crypto = require("crypto");
const { prisma } = require("../config/postgres");
const { sendEmail } = require("../utils/sendEmail");
const { generateTracking } = require("../controllers/emailTrackingController");
const { personalizeCampaignEmail } = require("../services/aiEmailService");
const { createInAppNotification } = require("../services/notificationService");
const { recordAudit } = require("../services/auditService");
const logger = require("../utils/logger");
const { activateCampaign } = require("../controllers/campaignController");


let running = false;

const tasks = {
  // Every minute: nudge new leads that haven't been contacted.
  async followupNewLeads() {
    const leads = await prisma.lead.findMany({
      where: { status: "new", followupSent: false, createdAt: { lt: new Date(Date.now() - 60_000) } },
      take: 50,
      include: { addedBy: true },
    });
    for (const lead of leads) {

      try {

        await createInAppNotification({
          userId: lead.addedById,
          orgId: lead.orgId,
          type: "LEAD_FOLLOWUP",
          category: "lead",
          message: `Don't forget to follow up with ${lead.name}.`,
          link: `/app/leads/${lead.id}`,
          metadata: { leadId: lead.id },
        });
        await prisma.lead.update({ where: { id: lead.id }, data: { followupSent: true } });
      } catch (e) {
        logger.error("job.followup.error", { leadId: lead.id, err: e.message });
      }
    }
    if (leads.length) logger.info("job.followup", { count: leads.length });
  },
  async processSequenceEnrollments() {
    const BATCH_SIZE = Math.max(1, Number(process.env.CAMPAIGN_EMAIL_BATCH_SIZE || 100));
    let totalProcessed = 0;

    // Process due enrollments in batches until the queue is empty.
    // BATCH_SIZE is only an internal safety/rate-control batch size; it is NOT a campaign recipient limit.
    while (true) {
      const now = new Date();

      const enrollments = await prisma.sequenceEnrollment.findMany({
        where: {
          status: "ACTIVE",
          nextRunAt: { lte: now },
        },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        include: {
          sequence: { select: { orgId: true } },
        },
      });

      if (enrollments.length === 0) break;

      for (const enrollment of enrollments) {

      try {

        const claimed = await prisma.sequenceEnrollment.updateMany({
          where: {
            id: enrollment.id,
            status: "ACTIVE",
            nextRunAt: {
              lte: now,
            },
          },
          data: {
            nextRunAt: null,
          },
        });

        if (claimed.count !== 1) {
          continue;
        }
        const stopEvent = await prisma.emailEvent.findFirst({
          where: {
            orgId: enrollment.sequence.orgId,
            recipient: enrollment.email,
            type: { in: ["BOUNCED", "REPLIED"] },
          },
          orderBy: { createdAt: "desc" },
        });

        if (stopEvent) {
          const stopStatus = stopEvent.type === "BOUNCED" ? "BOUNCED" : "REPLIED";

          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              status: stopStatus,
              nextRunAt: null,
            },
          });

          logger.info("job.sequence.stopped", {
            enrollmentId: enrollment.id,
            email: enrollment.email,
            reason: stopEvent.type,
          });

          continue;
        }
        const steps = enrollment.steps;

        if (!Array.isArray(steps) || steps.length === 0) {
          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: { status: "COMPLETED" },
          });
          continue;
        }

        const currentStep = steps[enrollment.currentStep];

        if (!currentStep) {
          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: { status: "COMPLETED" },
          });
          continue;
        }

     let firstName = "there";
let lead = null;

if (enrollment.leadId) {
  lead = await prisma.lead.findUnique({
  where: { id: enrollment.leadId },
  select: {
    name: true,
    companyName: true,
    jobTitle: true,
    industry: true,
    location: true,
  },
});

          if (lead?.name) {
            firstName = lead.name.split(" ")[0];
          }
        }

        let body = currentStep.body.replace(
  /{{first_name}}/gi,
  firstName
);



try {
  const personalized = await personalizeCampaignEmail({
    name: lead?.name || firstName,
    company: lead?.companyName || "",
    jobTitle: lead?.jobTitle || "",
    industry: lead?.industry || "",
    location: lead?.location || "",
    originalBody: body,
  });

  if (personalized?.output) {
    body = personalized.output;
  }
} catch (error) {
  logger.warn("job.sequence.ai_personalization_failed", {
    enrollmentId: enrollment.id,
    err: error.message,
  });
}

        const messageId = crypto.randomUUID();

        const tracking = generateTracking(
          enrollment.sequence.orgId,
          messageId,
          enrollment.email
        );

        const trackedBody = body.replace(
          /href=["']([^"']+)["']/gi,
          (match, url) => {
            if (!/^https?:\/\//i.test(url)) {
              return match;
            }

            const tracked = `${tracking.trackedLinks.length
              ? tracking.trackedLinks.find((link) => link.label === url)?.url
              : null}`;

            return tracked ? `href="${tracked}"` : match;
          }
        );

        const trackedHtml = `${trackedBody}
<img src="${tracking.openUrl}" width="1" height="1" style="display:none;" alt="" />`;

        const sendResult = await sendEmail({
          to: enrollment.email,
          subject: currentStep.subject,
          html: trackedHtml,
        });

        if (sendResult.skipped) {
          logger.warn("job.sequence.email_skipped", {
            enrollmentId: enrollment.id,
            email: enrollment.email,
            step: enrollment.currentStep,
            error: sendResult.error || "Email was skipped",
          });

          // Keep the enrollment on the current step.
          // Retry on the next scheduler run.
          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              nextRunAt: new Date(Date.now() + 15 * 60 * 1000),
            },
          });

          continue;
        }

        await prisma.emailEvent.create({
          data: {
            orgId: enrollment.sequence.orgId,
            type: "SENT",
            recipient: enrollment.email,
            subject: currentStep.subject,
            messageId,
          },
        });

        const nextStepIndex = enrollment.currentStep + 1;
        const nextStep = steps[nextStepIndex];

        if (!nextStep) {
          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              status: "COMPLETED",
              currentStep: nextStepIndex,
              nextRunAt: null,
              completedAt: new Date(),
            },
          });

          // Check whether every enrollment in this campaign sequence
          // has completed its final step.
          const remainingEnrollments =
            await prisma.sequenceEnrollment.count({
              where: {
                sequenceId: enrollment.sequenceId,
                status: {
                  not: "COMPLETED",
                },
              },
            });

          if (remainingEnrollments === 0) {
            const campaignSequence = await prisma.sequence.findUnique({
              where: { id: enrollment.sequenceId },
              select: { name: true },
            });

            if (campaignSequence?.name?.startsWith("Campaign: ")) {
              const campaignName =
                campaignSequence.name.slice("Campaign: ".length);

              const campaign = await prisma.workflow.findFirst({
                where: {
                  name: campaignName,
                },
                select: {
                  id: true,
                  conditions: true,
                },
              });

              if (campaign) {
                const conditions =
                  campaign.conditions &&
                  typeof campaign.conditions === "object"
                    ? campaign.conditions
                    : {};

                await prisma.workflow.update({
                  where: { id: campaign.id },
                  data: {
                    active: false,
                    conditions: {
                      ...conditions,
                      status: "completed",
                    },
                  },
                });
              }
            }
          }
        } else {
          const nextRunAt = new Date(
            enrollment.startedAt.getTime() +
            nextStep.day * 24 * 60 * 60 * 1000
          );

          if (nextStep.time) {
            const [hours, minutes] = String(nextStep.time)
              .split(":")
              .map(Number);

            if (
              Number.isInteger(hours) &&
              Number.isInteger(minutes) &&
              hours >= 0 &&
              hours <= 23 &&
              minutes >= 0 &&
              minutes <= 59
            ) {
              nextRunAt.setHours(hours, minutes, 0, 0);
            }
          }

          await prisma.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
              currentStep: nextStepIndex,
              nextRunAt,
            },
          });
        }

        logger.info("job.sequence.email_sent", {
          enrollmentId: enrollment.id,
          email: enrollment.email,
          step: enrollment.currentStep,
        });
      } catch (e) {
        logger.error("job.sequence.error", {
          enrollmentId: enrollment.id,
          err: e.message,
        });
      }
    }

      totalProcessed += enrollments.length;
      logger.info("job.sequence.batch", {
        count: enrollments.length,
        totalProcessed,
      });
    }

    if (totalProcessed) {
      logger.info("job.sequence", { count: totalProcessed });
    }
  },
  // Daily at 02:00: log a snapshot of platform metrics.
  async dailySnapshot() {
    const [users, orgs, leads, deals, activeSubs] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.lead.count(),
      prisma.deal.count(),
      prisma.organization.count({ where: { plan: { in: ["STARTER", "PRO", "ENTERPRISE"] } } }),
    ]);
    await recordAudit({
      action: "system.daily_snapshot",
      entityType: "System",
      metadata: { users, orgs, leads, deals, activeSubs, date: new Date().toISOString() },
    });
    logger.info("job.snapshot", { users, orgs, leads, deals, activeSubs });
  },
};

const activateDueCampaigns = async () => {
  const now = new Date();

  const campaigns = await prisma.workflow.findMany({
    where: {
      active: false,
      trigger: "SCHEDULED_TIME",
    },
    orderBy: {
      id: "asc",
    },
  });

  for (const campaign of campaigns) {
    try {
      const conditions =
        campaign.conditions &&
        typeof campaign.conditions === "object"
          ? campaign.conditions
          : {};

      if (
        conditions.status === "running" ||
        conditions.status === "completed" ||
        conditions.status === "cancelled" ||
        conditions.status === "paused"
      ) {
        continue;
      }

      if (!conditions.schedule) {
        continue;
      }

      const scheduledAt = new Date(conditions.schedule);

      if (
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt.getTime() > now.getTime()
      ) {
        continue;
      }

      const result = await activateCampaign({
        campaign,
        orgId: campaign.orgId,
        userId: campaign.userId,
        allowPastSchedule: true,
      });

      logger.info("job.campaign.auto_activated", {
        campaignId: campaign.id,
        campaignName: campaign.name,
        scheduledAt: result.scheduledAt,
        enrolled: result.enrolled,
      });
    } catch (e) {
      logger.error("job.campaign.auto_activation_error", {
        campaignId: campaign.id,
        campaignName: campaign.name,
        err: e.message,
      });
    }
  }
};

const run = async () => {
  if (running) return;
  running = true;

  try {

    await activateDueCampaigns();
    await tasks.followupNewLeads();
    await tasks.processSequenceEnrollments();
  } catch (e) {
    logger.error("job.tick.error", { err: e.message });
  } finally {
    running = false;
  }
};

const start = () => {
  if (process.env.DISABLE_CRON === "true") return;
  cron.schedule("* * * * *", run);
  cron.schedule("0 2 * * *", tasks.dailySnapshot);
  logger.info("jobs.scheduled");
};

module.exports = { start, tasks };



