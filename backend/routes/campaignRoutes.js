const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/campaignController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");
const { cacheMiddleware } = require("../utils/cache");

router.use(protect, tenantScope);

router.get("/metrics", ctrl.metrics);
router.get("/", cacheMiddleware(30), ctrl.list);
router.get("/:id", ctrl.get);
router.post("/", permit("OWNER", "ADMIN"), ctrl.create);
router.patch("/:id", permit("OWNER", "ADMIN"), ctrl.update);
router.delete("/:id", permit("OWNER", "ADMIN"), ctrl.remove);
router.post("/:id/launch", permit("OWNER", "ADMIN"), ctrl.launch);
router.post("/:id/pause", permit("OWNER", "ADMIN"), ctrl.pause);
router.post("/:id/resume", permit("OWNER", "ADMIN"), ctrl.resume);
router.post("/:id/stop", permit("OWNER","ADMIN"), ctrl.stop);
module.exports = router;
