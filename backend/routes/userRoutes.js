const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/userController");
const { protect, isAdmin } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const validate = require("../middleware/validate");
const { updateCurrentUserSchema } = require("../validations/userValidation");
const { permit } = require("../middleware/rbac");

router.get("/me", protect, ctrl.getCurrentUser);
router.patch("/me", protect, validate(updateCurrentUserSchema), ctrl.updateCurrentUser);
router.get("/", protect, tenantScope, permit("OWNER", "ADMIN"), ctrl.listUsers);
router.get("/:id", protect, tenantScope, permit("OWNER", "ADMIN"), ctrl.getUserById);

module.exports = router;
