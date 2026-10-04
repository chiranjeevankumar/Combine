const Joi = require("joi");

const updateCurrentUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  mobile: Joi.string().trim().max(20).allow("", null),
}).min(1);

module.exports = {
  updateCurrentUserSchema,
};
