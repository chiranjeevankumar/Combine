const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/sequenceController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope);

router.get("/", ctrl.list);
router.post("/", permit("OWNER", "ADMIN", "MEMBER"), ctrl.create);
router.get("/:id", ctrl.get);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/enroll", permit("OWNER", "ADMIN", "MEMBER"), ctrl.enroll);
router.get("/:id/metrics", ctrl.metrics);

module.exports = router;
