const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/kbController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");
const { cacheMiddleware } = require("../utils/cache");

router.use(protect, tenantScope);

router.get("/metrics", ctrl.metrics);
router.get("/", cacheMiddleware(120), ctrl.list);
router.get("/:id", ctrl.get);
router.post("/", permit("OWNER", "ADMIN", "MEMBER"), ctrl.create);
router.patch("/:id", permit("OWNER", "ADMIN", "MEMBER"), ctrl.update);
router.delete("/:id", permit("OWNER", "ADMIN"), ctrl.remove);
router.post("/:id/vote", ctrl.vote);

module.exports = router;
