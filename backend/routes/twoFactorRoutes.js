const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/twoFactorController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/status", ctrl.status);
router.post("/setup", ctrl.setup);
router.post("/verify", ctrl.verify);
router.post("/disable", ctrl.disable);
router.post("/backup-codes/regenerate", ctrl.regenerateBackupCodes);

module.exports = router;
