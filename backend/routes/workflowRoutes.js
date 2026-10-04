const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/workflowController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope);

router.get("/", ctrl.list);
router.get("/templates", (req, res) => res.json({ success: true, data: ctrl.TEMPLATES }));
router.get("/runs", ctrl.runs);
router.post("/", permit("OWNER", "ADMIN"), ctrl.create);
router.get("/:id", ctrl.get);
router.patch("/:id", permit("OWNER", "ADMIN"), ctrl.update);
router.delete("/:id", permit("OWNER", "ADMIN"), ctrl.remove);
router.post("/:id/toggle", permit("OWNER", "ADMIN"), ctrl.toggle);
router.post("/:id/test", permit("OWNER", "ADMIN"), ctrl.test);

module.exports = router;
