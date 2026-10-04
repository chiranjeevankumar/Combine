const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/usageController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");

router.use(protect, tenantScope);

router.get("/summary", ctrl.summary);
router.get("/history", ctrl.history);

module.exports = router;
