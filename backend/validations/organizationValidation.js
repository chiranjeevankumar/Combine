const Joi = require("joi");

const organizationPayload = {
  name: Joi.string().trim().min(2).max(120).required(),
  website: Joi.string().trim().uri().allow("", null),
  region: Joi.string().trim().max(80).allow("", null),
  type: Joi.string().trim().max(80).allow("", null),
  contactName: Joi.string().trim().max(120).allow("", null),
};

const createOrganizationSchema = Joi.object(organizationPayload);

const updateOrganizationSchema = Joi.object({
  name: organizationPayload.name.optional(),
  website: organizationPayload.website,
  region: organizationPayload.region,
  type: organizationPayload.type,
  contactName: organizationPayload.contactName,
}).min(1);

const organizationQuerySchema = Joi.object({
  search: Joi.string().trim().allow(""),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(12),
});

module.exports = {
  createOrganizationSchema,
  organizationQuerySchema,
  updateOrganizationSchema,
};
