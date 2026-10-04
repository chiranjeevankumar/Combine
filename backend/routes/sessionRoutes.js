const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/sessionController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

router.get("/", ctrl.list);
router.delete("/:id", ctrl.revoke);
router.post("/revoke-all", ctrl.revokeAll);

module.exports = router;
