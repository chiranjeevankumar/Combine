const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/auditController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope, permit("OWNER", "ADMIN"));

router.get("/", ctrl.list);

module.exports = router;
