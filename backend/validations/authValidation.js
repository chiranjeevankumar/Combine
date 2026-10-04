const Joi = require("joi");

const passwordSchema = Joi.string().min(8).max(128).required();
const emailSchema = Joi.string().trim().email({ tlds: { allow: false } }).required();

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email: emailSchema,
  password: passwordSchema,
  role: Joi.string().valid("ADMIN", "STARTUP", "INVESTOR").optional(),
  mobile: Joi.string().trim().max(20).allow("", null),
});

const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: emailSchema,
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required(),
  password: passwordSchema,
});

const otpEmailSchema = Joi.object({
  email: emailSchema,
});

const verifyOtpSchema = Joi.object({
  email: emailSchema,
  otp: Joi.string().trim().length(6).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema,
});

module.exports = {
  forgotPasswordSchema,
  loginSchema,
  otpEmailSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
};
