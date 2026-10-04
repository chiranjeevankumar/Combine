const express = require("express");
const router = express.Router();
const { stream } = require("../controllers/sseController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");

router.get("/stream", protect, tenantScope, stream);

module.exports = router;
