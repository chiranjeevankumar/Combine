const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/forecastController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope);

router.get("/", ctrl.list);
router.get("/current", ctrl.current);
router.post("/", permit("OWNER", "ADMIN"), ctrl.create);
router.delete("/:id", permit("OWNER", "ADMIN"), ctrl.remove);

module.exports = router;
