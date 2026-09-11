import Joi from "joi";

export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        error: "Validation failed",
        errors,
      });
    }

    req.body = value;
    next();
  };
};

export const schemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .messages({
        "string.pattern.base":
          "Password must contain at least one uppercase letter, one lowercase letter and one number",
      }),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  createProject: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    description: Joi.string().max(2000).allow("", null),
  }),

  updateProject: Joi.object({
    title: Joi.string().min(1).max(200),
    description: Joi.string().max(2000).allow("", null),
  }).min(1),

  createTask: Joi.object({
    title: Joi.string().min(1).max(200).required(),

    description: Joi.string().max(2000).allow("", null),

    assignedTo: Joi.string()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .allow(null),

    status: Joi.string()
      .valid("todo", "in-progress", "in-review", "done")
      .default("todo"),

    priority: Joi.string()
      .valid("low", "medium", "high", "critical")
      .default("medium"),

    dueDate: Joi.date().iso().allow(null),
  }),

  updateTask: Joi.object({
    title: Joi.string().min(1).max(200),

    description: Joi.string().max(2000).allow("", null),

    assignedTo: Joi.string()
      .guid({ version: ["uuidv4", "uuidv5"] })
      .allow(null),

    status: Joi.string().valid("todo", "in-progress", "in-review", "done"),

    priority: Joi.string().valid("low", "medium", "high", "critical"),

    dueDate: Joi.date().iso().allow(null),
  }).min(1),
};
