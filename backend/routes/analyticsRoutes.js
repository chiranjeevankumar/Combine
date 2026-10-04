const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");

router.use(protect, tenantScope);

router.get("/global", ctrl.getGlobalAnalytics);
router.get("/me", ctrl.getMyAnalytics);
router.get("/insights", ctrl.getAIAnalytics);
router.get("/ai", ctrl.getAIAnalytics);
router.get("/funnel", ctrl.getFunnel);
router.get("/timeseries", ctrl.getTimeSeries);

module.exports = router;
