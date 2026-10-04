const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/ai.controller");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");

router.get("/", ctrl.list);
router.get("/status", ctrl.status);
router.post("/recommend", protect, tenantScope, ctrl.recommend);
router.post("/outreach", ctrl.outreach);
router.post("/summarize", ctrl.summarize);

module.exports = router;
