const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/aiScoringController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope);

router.get("/insights", ctrl.insights);
router.post("/score/:id", permit("OWNER", "ADMIN", "MEMBER"), ctrl.scoreOne);
router.post("/score-batch", permit("OWNER", "ADMIN"), ctrl.scoreBatch);
router.post("/score-all", permit("OWNER", "ADMIN"), ctrl.scoreAll);

module.exports = router;
