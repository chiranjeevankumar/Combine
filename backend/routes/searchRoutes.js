const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/searchController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const { cacheMiddleware } = require("../utils/cache");

router.use(protect, tenantScope);

router.get("/", cacheMiddleware(30), ctrl.search);
router.get("/suggest", ctrl.suggest);

module.exports = router;
