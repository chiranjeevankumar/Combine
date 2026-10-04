const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/healthScoreController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");
const { cacheMiddleware } = require("../utils/cache");

router.use(protect, tenantScope);

router.get("/analytics", ctrl.analytics);
router.get("/", cacheMiddleware(60), ctrl.list);
router.get("/:leadId", ctrl.get);
router.post("/:leadId/recompute", permit("OWNER", "ADMIN", "MEMBER"), ctrl.recompute);

module.exports = router;
