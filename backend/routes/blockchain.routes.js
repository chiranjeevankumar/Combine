const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/blockchainController");

router.get("/", ctrl.list);
router.post("/store", ctrl.storeOnChain);
router.get("/fetch/:id", ctrl.fetchFromChain);
router.get("/transactions", ctrl.getTransactions);
router.get("/transaction/:txHash", ctrl.getTransactionByHash);
router.get("/stats", ctrl.getStats);

module.exports = router;
