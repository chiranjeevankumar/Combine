// Campaign management - marketing automation and email campaigns.
const { prisma } = require("../config/postgres");
const { AppError } = require("../middleware/errorHandler");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { recordAudit } = require("../services/auditService");
const { invalidateCache } = require("../utils/cache");

// Campaigns are stored using the existing Workflow model with JSON metadata.
// This provides full campaign management without new schema.

const CAMPAIGN_STATUSES = ["draft", "scheduled", "running", "paused", "completed", "cancelled"];
const CAMPAIGN_TYPES = ["email", "sms", "social", "webhook", "multi_channel"];

const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, status, type } = req.query;
  const where = { orgId: req.orgId };
  // Workflow model has 'active' (Boolean), not 'status' (String)
  if (status) where.active = (status === "running");
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    prisma.workflow.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: Number(limit) }),
    prisma.workflow.count({ where }),
  ]);
  return response.paginated(res, items, total, page, limit);
});

const get = asyncHandler(async (req, res) => {
  const campaign = await prisma.workflow.findFirst({ where: { id: Number(req.params.id), orgId: req.orgId } });
  if (!campaign) throw new AppError("Campaign not found.", 404);
  return response.success(res, campaign);
});

const create = asyncHandler(async (req, res) => {
  const {
  name,
  description,
  subject,
  body,
  audience,
  steps,
  type = "email",
  status = "draft",
  segment,
  content,
  schedule,
  budget,
} = req.body;
  if (!name) throw new AppError("name is required.", 400);
  // WorkflowTrigger enum: use "SCHEDULED_TIME" as the default campaign trigger.
  // Store the campaign type inside the conditions JSON object.
  const campaign = await prisma.workflow.create({
    data: {
      orgId: req.orgId,
      userId: req.user.id,
      name, description: description || null,
      trigger: "SCHEDULED_TIME",
      conditions: {
  segment: segment || null,
  subject: subject || steps?.[0]?.subject || "",
  body: body || steps?.[0]?.body || "",
  audience: audience || "all",
  steps: steps || [
    {
      day: 0,
      subject: subject || "",
      body: body || "",
    },
  ],
  type,
  schedule: schedule || null,
  status: schedule ? "scheduled" : status,
  budget: budget || null,
},
      actions: content || [{ type: "SEND_EMAIL" }],
      active: status === "running",
    },
  });
  await recordAudit({ userId: req.user.id, orgId: req.orgId, action: "campaign.create", entityType: "Campaign", entityId: campaign.id, metadata: { name, type, status } });
  invalidateCache("/campaigns");
  return response.created(res, campaign);
});

const update = asyncHandler(async (req, res) => {
  const {
  name,
  description,
  subject,
  body,
  audience,
  steps,
  status,
  segment,
  content,
  budget,
  schedule,
  } = req.body;
  const campaign = await prisma.workflow.findFirst({ where: { id: Number(req.params.id), orgId: req.orgId } });
  if (!campaign) throw new AppError("Campaign not found.", 404);
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.active = status === "running";
  if (
  segment !== undefined ||
  budget !== undefined ||
  subject !== undefined ||
  body !== undefined ||
  audience !== undefined ||
  steps !== undefined
  ) {
  const existingConditions =
    (typeof campaign.conditions === "object" && campaign.conditions)
      ? campaign.conditions
      : {};
  if (segment !== undefined)
    existingConditions.segment = segment;
  if (budget !== undefined)
    existingConditions.budget = budget;
  if (subject !== undefined)
    existingConditions.subject = subject;
  if (body !== undefined)
  existingConditions.body = body;
  if (steps !== undefined)
  existingConditions.steps = steps;
  if (audience !== undefined)
    existingConditions.audience = audience;
  data.conditions = existingConditions;
  }
  if (schedule !== undefined) {
    const scheduledAt = schedule ? new Date(schedule) : null;
    if (schedule && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
      throw new AppError("A valid campaign schedule date and time is required.", 400);
    }
    const existingConditions =
      (typeof campaign.conditions === "object" && campaign.conditions)
        ? campaign.conditions
        : {};
    existingConditions.schedule = scheduledAt ? scheduledAt.toISOString() : null;
    data.conditions = existingConditions;
  }
  if (content !== undefined) data.actions = content;
  await prisma.workflow.update({ where: { id: campaign.id }, data });
  invalidateCache("/campaigns");
  return response.success(res, { message: "Campaign updated." });
  });

const remove = asyncHandler(async (req, res) => {
  const result = await prisma.workflow.deleteMany({ where: { id: Number(req.params.id), orgId: req.orgId } });
  if (result.count === 0) throw new AppError("Campaign not found.", 404);
  invalidateCache("/campaigns");
  return response.success(res, { message: "Campaign deleted." });
});

const activateCampaign = async ({
  campaign,
  orgId,
  userId,
  allowPastSchedule = false,
}) => {
  if (!campaign) {
    throw new AppError("Campaign not found.", 404);
  }

  if (campaign.conditions?.status === "running") {
    return {
      alreadyRunning: true,
      scheduledAt: campaign.conditions?.schedule || null,
      enrolled: 0,
    };
  }

  const conditions =
    typeof campaign.conditions === "object" && campaign.conditions
      ? campaign.conditions
      : {};

  const subject = conditions.subject || "";
  const body = conditions.body || "";
  const audience = conditions.audience || "all";
  const scheduledAt = conditions.schedule
    ? new Date(conditions.schedule)
    : null;

  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    throw new AppError(
      "A valid campaign schedule date and time is required.",
      400
    );
  }

  if (!allowPastSchedule && scheduledAt.getTime() < Date.now()) {
    throw new AppError(
      "Campaign schedule must be in the future.",
      400
    );
  }

  const campaignSteps = Array.isArray(conditions.steps)
    ? conditions.steps
    : [
        {
          day: 0,
          subject,
          body,
        },
      ];

  if (!subject) {
    throw new AppError("Campaign subject is required.", 400);
  }

  if (!body) {
    throw new AppError("Campaign email body is required.", 400);
  }

  const audienceConfig =
    typeof audience === "string"
      ? { type: audience }
      : (audience || { type: "all" });

  const audienceType = audienceConfig.type || "all";

  let leads;
  const leadWhere = {
    orgId,
  };

  if (audienceType === "tag") {
    const tagId = Number(audienceConfig.tagId);

    if (!Number.isInteger(tagId) || tagId <= 0) {
      throw new AppError("A valid audience tag is required.", 400);
    }

    leadWhere.tags = {
      some: {
        tagId,
      },
    };
  } else if (audienceType === "status") {
    if (!audienceConfig.status) {
      throw new AppError(
        "A valid audience status is required.",
        400
      );
    }

    leadWhere.status = audienceConfig.status;
  } else if (
    audienceType !== "all" &&
    audienceType !== "segment"
  ) {
    throw new AppError("Unsupported campaign audience.", 400);
  }

  if (audienceType === "segment") {
    const savedSearchId = Number(audienceConfig.savedSearchId);

    if (!Number.isInteger(savedSearchId) || savedSearchId <= 0) {
      throw new AppError(
        "A valid saved audience segment is required.",
        400
      );
    }

    const savedSearch = await prisma.savedSearch.findFirst({
      where: {
        id: savedSearchId,
        orgId,
      },
    });

    if (!savedSearch) {
      throw new AppError(
        "Saved audience segment not found.",
        404
      );
    }

    const filters =
      savedSearch.filters &&
      typeof savedSearch.filters === "object"
        ? savedSearch.filters
        : {};

    if (filters.status) {
      leadWhere.status = filters.status;
    }

    if (filters.tagId) {
      leadWhere.tags = {
        some: {
          tagId: Number(filters.tagId),
        },
      };
    }

    if (filters.source) {
      leadWhere.source = filters.source;
    }

    if (filters.assigneeId) {
      leadWhere.assignedToId = Number(filters.assigneeId);
    }
  }

  leads = await prisma.lead.findMany({
    where: leadWhere,
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (leads.length === 0) {
    throw new AppError(
      "No leads with email addresses found.",
      400
    );
  }

  // Prevent duplicate activation if another scheduler/manual request
  // has already created the campaign sequence.
  const existingSequence = await prisma.sequence.findFirst({
    where: {
      orgId,
      name: `Campaign: ${campaign.name}`,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  if (existingSequence) {
    return {
      alreadyRunning: true,
      scheduledAt: scheduledAt.toISOString(),
      enrolled: 0,
    };
  }

  const sequence = await prisma.sequence.create({
    data: {
      orgId,
      userId,
      name: `Campaign: ${campaign.name}`,
      description: campaign.description || null,
      status: "ACTIVE",
      steps: campaignSteps,
    },
  });

  for (const lead of leads) {
    await prisma.sequenceEnrollment.create({
      data: {
        sequenceId: sequence.id,
        leadId: lead.id,
        email: lead.email,
        status: "ACTIVE",
        currentStep: 0,
        steps: campaignSteps,
        startedAt: scheduledAt,
        nextRunAt: scheduledAt,
      },
    });
  }

  await prisma.workflow.update({
    where: { id: campaign.id },
    data: {
      active: true,
      conditions: {
        ...conditions,
        status: "running",
        schedule: scheduledAt.toISOString(),
      },
    },
  });

  invalidateCache("/campaigns");

  return {
    alreadyRunning: false,
    scheduledAt: scheduledAt.toISOString(),
    enrolled: leads.length,
  };
};

const launch = asyncHandler(async (req, res) => {
  const campaign = await prisma.workflow.findFirst({
    where: {
      id: Number(req.params.id),
      orgId: req.orgId,
    },
  });

  if (!campaign) {
    throw new AppError("Campaign not found.", 404);
  }

  const result = await activateCampaign({
    campaign,
    orgId: req.orgId,
    userId: req.user.id,
    allowPastSchedule: false,
  });

  return response.success(res, {
    message: "Campaign scheduled.",
    scheduledAt: result.scheduledAt,
    enrolled: result.enrolled,
  });
});

const pause = asyncHandler(async (req, res) => {
  const campaign = await prisma.workflow.findFirst({
    where: {
      id: Number(req.params.id),
      orgId: req.orgId,
    },
  });

  if (!campaign) {
    throw new AppError("Campaign not found.", 404);
  }

  const sequence = await prisma.sequence.findFirst({
    where: {
      orgId: req.orgId,
      name: `Campaign: ${campaign.name}`,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await prisma.workflow.update({
    where: {
      id: campaign.id,
    },
    data: {
  active: false,
  conditions: {
    ...(typeof campaign.conditions === "object" && campaign.conditions
      ? campaign.conditions
      : {}),
    status: "paused",
  },
},
  });

  if (sequence) {
    await prisma.sequenceEnrollment.updateMany({
      where: {
        sequenceId: sequence.id,
        status: "ACTIVE",
      },
      data: {
        status: "PAUSED",
      },
    });

    await prisma.sequence.update({
      where: {
        id: sequence.id,
      },
      data: {
        status: "PAUSED",
      },
    });
  }

  invalidateCache("/campaigns");

  return response.success(res, {
    message: "Campaign paused.",
  });
});

const resume = asyncHandler(async (req, res) => {
  const campaign = await prisma.workflow.findFirst({
    where: {
      id: Number(req.params.id),
      orgId: req.orgId,
    },
  });

  if (!campaign) {
    throw new AppError("Campaign not found.", 404);
  }

  const sequence = await prisma.sequence.findFirst({
    where: {
      orgId: req.orgId,
      name: `Campaign: ${campaign.name}`,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

 await prisma.workflow.update({
  where: {
    id: campaign.id,
  },
  data: {
    active: true,
    conditions: {
      ...(typeof campaign.conditions === "object" && campaign.conditions
        ? campaign.conditions
        : {}),
      status: "running",
    },
  },
});

  if (sequence) {
    await prisma.sequenceEnrollment.updateMany({
      where: {
        sequenceId: sequence.id,
        status: "PAUSED",
      },
      data: {
        status: "ACTIVE",
      },
    });

    await prisma.sequence.update({
      where: {
        id: sequence.id,
      },
      data: {
        status: "ACTIVE",
      },
    });
  }

  invalidateCache("/campaigns");

  return response.success(res, {
    message: "Campaign resumed.",
  });
});

const stop = asyncHandler(async (req, res) => {
  const campaign = await prisma.workflow.findFirst({
    where: {
      id: Number(req.params.id),
      orgId: req.orgId,
    },
  });

  if (!campaign) {
    throw new AppError("Campaign not found.", 404);
  }

  const sequence = await prisma.sequence.findFirst({
    where: {
      orgId: req.orgId,
      name: `Campaign: ${campaign.name}`,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await prisma.workflow.update({
    where: {
      id: campaign.id,
    },
    data: {
      active: false,
      conditions: {
        ...(typeof campaign.conditions === "object" && campaign.conditions
          ? campaign.conditions
          : {}),
        status: "cancelled",
      },
    },
  });

  if (sequence) {
    await prisma.sequenceEnrollment.updateMany({
      where: {
        sequenceId: sequence.id,
        status: {
          in: ["ACTIVE", "PAUSED"],
        },
      },
      data: {
        status: "STOPPED",
      },
    });

    await prisma.sequence.update({
      where: {
        id: sequence.id,
      },
      data: {
        status: "ARCHIVED",
      },
    });
  }

  invalidateCache("/campaigns");

  return response.success(res, {
    message: "Campaign stopped.",
  });
});

const metrics = asyncHandler(async (req, res) => {
  const campaigns = await prisma.workflow.findMany({
    where: { orgId: req.orgId },
    select: {
      id: true,
      active: true,
      conditions: true,
      runCount: true,
      lastRunAt: true,
      trigger: true,
    },
  });

  let running = 0;
  let paused = 0;
  let totalRuns = 0;

  for (const c of campaigns) {
    const status =
      typeof c.conditions === "object" && c.conditions
        ? c.conditions.status
        : null;

    if (status === "running") running++;
    if (status === "paused") paused++;

    totalRuns += c.runCount || 0;
  }

  return response.success(res, {
    total: campaigns.length,
    running,
    paused,
    totalRuns,
  });
});

module.exports = {
  activateCampaign,
  list,
  get,
  create,
  update,
  remove,
  launch,
  pause,
  resume,
  stop,
  metrics,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES
};
