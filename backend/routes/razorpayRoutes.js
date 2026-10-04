const express = require("express");
const router = express.Router();
const billingController = require("../controllers/billingController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");

router.post("/create-order", protect, tenantScope, billingController.createOrder);
router.post("/verify-payment", protect, tenantScope, billingController.verifyPayment);

module.exports = router;