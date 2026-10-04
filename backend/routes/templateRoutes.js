const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/templateController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope);

router.get("/", ctrl.list);
router.get("/categories", ctrl.categories);
router.post("/", permit("OWNER", "ADMIN", "MEMBER"), ctrl.create);
router.post("/:id/use", ctrl.use);
router.get("/:id", ctrl.get);
router.patch("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
