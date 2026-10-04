const prisma = require("../config/postgres");

function normalizeAudience(audience) {
  return String(audience || "all").toLowerCase();
}

function valuesMatch(actual, expected) {
  if (expected === undefined || expected === null || expected === "") {
    return true;
  }

  if (Array.isArray(expected)) {
    return expected.map(String).includes(String(actual));
  }

  return String(actual) === String(expected);
}

async function matchesSavedSearchFilters(lead, filters, orgId) {
  if (!filters || typeof filters !== "object") {
    return true;
  }

  if (filters.status && !valuesMatch(lead.status, filters.status)) {
    return false;
  }

  if (filters.source && !valuesMatch(lead.source, filters.source)) {
    return false;
  }

  if (filters.assigneeId && !valuesMatch(lead.assignedToId, filters.assigneeId)) {
    return false;
  }

  if (filters.tagId) {
    const tagRelation = await prisma.leadTag.findFirst({
      where: {
        leadId: lead.id,
        tagId: Number(filters.tagId),
        ...(orgId
          ? {
              lead: {
                orgId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (!tagRelation) {
      return false;
    }
  }

  return true;
}

async function leadMatchesAudience(lead, campaign, orgId) {
  const audience = normalizeAudience(campaign.audience);

  if (audience === "all") {
    return true;
  }

  if (audience === "status") {
    return valuesMatch(lead.status, campaign.audienceValue);
  }

  if (audience === "tag") {
    const tagId = Number(campaign.audienceValue);

    if (!Number.isFinite(tagId)) {
      return false;
    }

    const tagRelation = await prisma.leadTag.findFirst({
      where: {
        leadId: lead.id,
        tagId,
        ...(orgId
          ? {
              lead: {
                orgId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    return Boolean(tagRelation);
  }

  if (audience === "segment") {
    const savedSearchId = Number(campaign.audienceValue);

    if (!Number.isFinite(savedSearchId)) {
      return false;
    }

    const savedSearch = await prisma.savedSearch.findFirst({
      where: {
        id: savedSearchId,
        ...(orgId
          ? {
              OR: [{ orgId }, { orgId: null }],
            }
          : {}),
      },
      select: {
        filters: true,
      },
    });

    if (!savedSearch) {
      return false;
    }

    return matchesSavedSearchFilters(lead, savedSearch.filters, orgId);
  }

  return false;
}

async function getCampaignSequence(campaign, orgId) {
  return prisma.sequence.findFirst({
    where: {
      orgId,
      name: `Campaign: ${campaign.name}`,
      status: "ACTIVE",
    },
    select: {
      id: true,
      steps: true,
    },
  });
}

async function enrollLeadInActiveCampaigns(lead, orgId, userId) {
  if (!lead || !lead.id || !orgId || !userId) {
    return {
      enrolled: 0,
      skipped: 0,
      campaignsChecked: 0,
    };
  }

  const campaigns = await prisma.workflow.findMany({
    where: {
      orgId,
      active: true,
      trigger: "SCHEDULED_TIME",
    },
  });

  let enrolled = 0;
  let skipped = 0;
  let campaignsChecked = 0;

  for (const campaign of campaigns) {
    campaignsChecked += 1;

    const conditions =
      campaign.conditions && typeof campaign.conditions === "object"
        ? campaign.conditions
        : {};

    if (conditions.status !== "running") {
      continue;
    }

    if (!(await leadMatchesAudience(lead, campaign, orgId))) {
      continue;
    }

    const sequence = await getCampaignSequence(campaign, orgId);

    if (!sequence) {
      continue;
    }

    const existingEnrollment = await prisma.sequenceEnrollment.findFirst({
      where: {
        sequenceId: sequence.id,
        leadId: lead.id,
      },
      select: {
        id: true,
      },
    });

    if (existingEnrollment) {
      skipped += 1;
      continue;
    }

    const enrollmentStartedAt = new Date();

    await prisma.sequenceEnrollment.create({
      data: {
        sequenceId: sequence.id,
        leadId: lead.id,
        email: lead.email,
        status: "ACTIVE",
        currentStep: 0,
        steps: sequence.steps,
        startedAt: enrollmentStartedAt,
        nextRunAt: enrollmentStartedAt,
      },
    });

    enrolled += 1;
  }

  return {
    enrolled,
    skipped,
    campaignsChecked,
  };
}

module.exports = {
  normalizeAudience,
  valuesMatch,
  matchesSavedSearchFilters,
  leadMatchesAudience,
  getCampaignSequence,
  enrollLeadInActiveCampaigns,
};
