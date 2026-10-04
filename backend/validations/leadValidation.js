const Joi = require("joi");

const statusValues = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "in_progress",
  "closed",
];

const sourceValues = [
  "website",
  "referral",
  "social_media",
  "email_campaign",
  "cold_call",
  "trade_show",
  "partner",
  "other",
  "import",
  "api",
  "database_search",
  "domain_search",
  "email_search",
  "social_search"
];
const emailSchema = Joi.string()
  .trim()
  .email({ tlds: { allow: false } })
  .required();

const leadPayload = {
  name: Joi.string().trim().min(2).max(120).required(),
  email: emailSchema,
  phone: Joi.string().trim().max(30).allow("", null),
  domain: Joi.string().trim().max(120).allow("", null),
  companyName: Joi.string().trim().max(120).allow("", null),
  jobTitle: Joi.string().trim().max(120).allow("", null),
  status: Joi.string()
    .trim()
    .valid(...statusValues)
    .default("new"),
  source: Joi.string()
    .trim()
    .valid(...sourceValues)
    .default("other"),
  engagement: Joi.object().unknown(true).optional(),
};


const createLeadSchema = Joi.object(leadPayload);

const updateLeadSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  email: Joi.string().trim().email({ tlds: { allow: false } }),
  phone: Joi.string().trim().max(30).allow("", null),
  domain: Joi.string().trim().max(120).allow("", null),
  companyName: Joi.string().trim().max(120).allow("", null),
  jobTitle: Joi.string().trim().max(120).allow("", null),
  status: Joi.string()
    .trim()
    .valid(...statusValues),
  source: Joi.string()
    .trim()
    .valid(...sourceValues),
  engagement: Joi.object().unknown(true),
}).min(1);

const leadQuerySchema = Joi.object({
  search: Joi.string().trim().allow(""),
  status: Joi.string()
    .trim()
    .valid(...statusValues)
    .optional(),
  source: Joi.string()
    .trim()
    .valid(...sourceValues)
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
  sortBy: Joi.string()
    .valid("createdAt", "updatedAt", "name", "email", "score")
    .default("createdAt"),
  order: Joi.string().valid("asc", "desc").default("desc"),
});

module.exports = {
  createLeadSchema,
  leadQuerySchema,
  updateLeadSchema,
};
