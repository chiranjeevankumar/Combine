const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/customFieldController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope);

router.get("/", ctrl.list);
router.post("/", permit("OWNER", "ADMIN"), ctrl.create);
router.patch("/:id", permit("OWNER", "ADMIN"), ctrl.update);
router.delete("/:id", permit("OWNER", "ADMIN"), ctrl.remove);

module.exports = router;
