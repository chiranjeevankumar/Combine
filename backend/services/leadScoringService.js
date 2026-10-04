const { prisma } = require('../config/postgres');

/**
 * Lead Scoring Service
 * Calculates and updates lead scores based on source and engagement metrics
 */

// Source score weights (out of 40 points)
const SOURCE_SCORES = {
    referral: 40,
    partner: 35,
    website: 30,
    trade_show: 25,
    social_media: 20,
    email_campaign: 15,
    cold_call: 10,
    other: 5
};

// Engagement score weights (out of 60 points)
const ENGAGEMENT_WEIGHTS = {
    emailOpens: 2,
    emailClicks: 5,
    websiteVisits: 8,
    formSubmissions: 15,
    phoneCallsMade: 10,
    meetingsAttended: 20
};

function calculateEngagementScore(engagement) {
    if (!engagement) return 0;

    let score = 0;

    score += (engagement.emailOpens || 0) * ENGAGEMENT_WEIGHTS.emailOpens;
    score += (engagement.emailClicks || 0) * ENGAGEMENT_WEIGHTS.emailClicks;
    score += (engagement.websiteVisits || 0) * ENGAGEMENT_WEIGHTS.websiteVisits;
    score += (engagement.formSubmissions || 0) * ENGAGEMENT_WEIGHTS.formSubmissions;
    score += (engagement.phoneCallsMade || 0) * ENGAGEMENT_WEIGHTS.phoneCallsMade;
    score += (engagement.meetingsAttended || 0) * ENGAGEMENT_WEIGHTS.meetingsAttended;

    return Math.min(score, 60);
}

function calculateSourceScore(source) {
    return SOURCE_SCORES[source] || SOURCE_SCORES.other;
}

function calculateLeadScore(lead) {
    const sourceScore = calculateSourceScore(lead.source);
    const engagementScore = calculateEngagementScore(lead.engagement);
    const totalScore = Math.min(sourceScore + engagementScore, 100);

    return {
        totalScore,
        sourceScore,
        engagementScore,
        lastCalculated: new Date()
    };
}

/**
 * Update lead score for a single lead
 */
async function updateLeadScore(leadId) {
    try {

        const lead = await prisma.lead.findUnique({
            where: { id: Number(leadId) }
        });

        if (!lead) {
            throw new Error('Lead not found');
        }

        const scoreData = calculateLeadScore(lead);

        const updatedLead = await prisma.lead.update({
            where: { id: Number(leadId) },
            data: {
                score: scoreData.totalScore,
                scoreDetails: {
                    sourceScore: scoreData.sourceScore,
                    engagementScore: scoreData.engagementScore,
                    lastCalculated: scoreData.lastCalculated
                }
            }
        });

        return updatedLead;

    } catch (error) {
        console.error('Error updating lead score:', error);
        throw error;
    }
}

/**
 * Update scores for multiple leads
 */
async function updateMultipleLeadScores(leadIds = null) {
    try {

        const leads = leadIds
            ? await prisma.lead.findMany({
                where: { id: { in: leadIds.map(id => Number(id)) } }
            })
            : await prisma.lead.findMany();

        const updatePromises = leads.map(async (lead) => {

            const scoreData = calculateLeadScore(lead);

            return prisma.lead.update({
                where: { id: lead.id },
                data: {
                    score: scoreData.totalScore,
                    scoreDetails: {
                        sourceScore: scoreData.sourceScore,
                        engagementScore: scoreData.engagementScore,
                        lastCalculated: scoreData.lastCalculated
                    }
                }
            });

        });

        const updatedLeads = await Promise.all(updatePromises);

        return {
            success: true,
            count: updatedLeads.length,
            message: `Successfully updated ${updatedLeads.length} lead scores`
        };

    } catch (error) {
        console.error('Error updating multiple lead scores:', error);
        throw error;
    }
}

/**
 * Get prioritized leads
 */
async function getPrioritizedLeads(options = {}) {
    try {

        const {
            limit = 50,
            minScore = 0,
            status = null,
            sortOrder = -1
        } = options;

        const leads = await prisma.lead.findMany({
            where: {
                score: { gte: minScore },
                ...(status && { status })
            },
            orderBy: [
                { score: sortOrder === -1 ? 'desc' : 'asc' },
                { updatedAt: 'desc' }
            ],
            take: limit,
            include: {
                addedBy: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        return leads;

    } catch (error) {
        console.error('Error getting prioritized leads:', error);
        throw error;
    }
}

/**
 * Lead score statistics
 */
async function getLeadScoreStatistics() {
    try {

        const stats = await prisma.lead.aggregate({
            _avg: { score: true },
            _max: { score: true },
            _min: { score: true },
            _count: { score: true }
        });

        const leads = await prisma.lead.findMany({
            select: { id: true, score: true }
        });

        const ranges = {
            low: 0,
            medium: 0,
            high: 0,
            veryHigh: 0
        };

        leads.forEach(l => {
            if (l.score < 25) ranges.low++;
            else if (l.score < 50) ranges.medium++;
            else if (l.score < 75) ranges.high++;
            else ranges.veryHigh++;
        });

        return {
            overall: {
                avgScore: stats._avg.score || 0,
                maxScore: stats._max.score || 0,
                minScore: stats._min.score || 0,
                totalLeads: stats._count.score || 0
            },
            scoreRanges: [
                { range: 'Low (0-24)', count: ranges.low },
                { range: 'Medium (25-49)', count: ranges.medium },
                { range: 'High (50-74)', count: ranges.high },
                { range: 'Very High (75-100)', count: ranges.veryHigh }
            ]
        };

    } catch (error) {
        console.error('Error getting lead score statistics:', error);
        throw error;
    }
}

/**
 * Update engagement metric
 */
async function updateEngagementMetric(leadId, metricType, increment = 1) {
    try {

        const lead = await prisma.lead.findUnique({
            where: { id: Number(leadId) }
        });

        if (!lead) {
            throw new Error('Lead not found');
        }

        let engagement = lead.engagement || {};

        engagement[metricType] = (engagement[metricType] || 0) + increment;

        const scoreData = calculateLeadScore({
            ...lead,
            engagement
        });

        const updatedLead = await prisma.lead.update({
            where: { id: Number(leadId) },
            data: {
                engagement,
                score: scoreData.totalScore,
                scoreDetails: {
                    sourceScore: scoreData.sourceScore,
                    engagementScore: scoreData.engagementScore,
                    lastCalculated: scoreData.lastCalculated
                }
            }
        });

        return updatedLead;

    } catch (error) {
        console.error('Error updating engagement metric:', error);
        throw error;
    }
}

module.exports = {
    calculateLeadScore,
    updateLeadScore,
    updateMultipleLeadScores,
    getPrioritizedLeads,
    getLeadScoreStatistics,
    updateEngagementMetric,
    SOURCE_SCORES,
    ENGAGEMENT_WEIGHTS
};