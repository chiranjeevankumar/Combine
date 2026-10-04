const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/commissionController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope);

router.get("/metrics", ctrl.metrics);
router.get("/", ctrl.list);
router.get("/:userId/:id", ctrl.get);
router.post("/", permit("OWNER", "ADMIN"), ctrl.create);
router.patch("/:userId/:id", permit("OWNER", "ADMIN"), ctrl.update);
router.delete("/:userId/:id", permit("OWNER", "ADMIN"), ctrl.remove);

module.exports = router;
