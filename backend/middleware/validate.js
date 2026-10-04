const { AppError } = require("./errorHandler");

const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      next(
        new AppError(
          "Validation failed.",
          400,
          error.details.map((detail) => detail.message),
        ),
      );
      return;
    }

    req[source] = value;
    next();
  };
};

module.exports = validate;
