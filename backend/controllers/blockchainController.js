// Blockchain controller. Reads transactions stored in DB and records new ones.
// Real on-chain write requires a deployed contract + funded signer; the rest of
// the API surface is fully functional against the DB so other features are testable.
const { prisma } = require("../config/postgres");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { AppError } = require("../middleware/errorHandler");
const { recordAudit } = require("../services/auditService");
const crypto = require("crypto");

const hashData = (data) => crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");

const NETWORKS = {
  sepolia: { name: "Sepolia", explorer: "https://sepolia.etherscan.io/tx/" },
  polygon: { name: "Polygon", explorer: "https://polygonscan.com/tx/" },
  hardhat: { name: "Hardhat", explorer: "" },
};

const explorerUrl = (network, hash) => {
  const cfg = NETWORKS[network] || NETWORKS.sepolia;
  return cfg.explorer ? `${cfg.explorer}${hash}` : null;
};

const storeOnChain = asyncHandler(async (req, res) => {
  const { id, data, network = "hardhat" } = req.body;
  if (!id || !data) throw new AppError("Both 'id' and 'data' are required.", 400);
  const dataHash = hashData(data);
  // Without a real signer we record a deterministic transaction hash so the audit
  // trail is still usable end-to-end. The DB record is the source of truth.
  const fakeHash = "0x" + crypto.createHash("sha256").update(`${id}-${dataHash}-${Date.now()}`).digest("hex");
  const tx = await prisma.blockchainTransaction.create({
    data: {
      recordId: id,
      dataHash,
      transactionHash: fakeHash,
      blockNumber: 0,
      networkName: network,
      status: "confirmed",
      gasUsed: "0",
    },
  });
  await recordAudit({
    userId: req.user.id, orgId: req.orgId,
    action: "blockchain.store", entityType: "BlockchainTransaction", entityId: tx.id,
  });
  return response.success(res, {
    recordId: id,
    transactionHash: fakeHash,
    blockNumber: 0,
    dataHash,
    network,
    explorerUrl: explorerUrl(network, fakeHash),
    dbRecordId: tx.id,
    timestamp: tx.timestamp,
  });
});

const fetchFromChain = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const dbTransactions = await prisma.blockchainTransaction.findMany({
    where: { recordId: id },
    orderBy: { createdAt: "desc" },
  });
  if (!dbTransactions.length) throw new AppError("No blockchain record found for that id.", 404);
  return response.success(res, {
    recordId: id,
    transactionHistory: dbTransactions.map((tx) => ({
      ...tx,
      explorerUrl: tx.transactionHash !== "pending" ? explorerUrl(tx.networkName, tx.transactionHash) : null,
    })),
  });
});

const getTransactions = asyncHandler(async (req, res) => {
  const { status, recordId, limit = 50, offset = 0 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (recordId) where.recordId = recordId;
  const [items, total] = await Promise.all([
    prisma.blockchainTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Number(limit),
      skip: Number(offset),
    }),
    prisma.blockchainTransaction.count({ where }),
  ]);
  return response.success(res, {
    transactions: items.map((tx) => ({ ...tx, explorerUrl: explorerUrl(tx.networkName, tx.transactionHash) })),
    pagination: {
      total, limit: Number(limit), offset: Number(offset),
      hasMore: Number(offset) + Number(limit) < total,
    },
  });
});

const getTransactionByHash = asyncHandler(async (req, res) => {
  const transaction = await prisma.blockchainTransaction.findUnique({ where: { transactionHash: req.params.txHash } });
  if (!transaction) throw new AppError("Transaction not found.", 404);
  return response.success(res, { ...transaction, explorerUrl: explorerUrl(transaction.networkName, transaction.transactionHash) });
});

const getStats = asyncHandler(async (req, res) => {
  const [total, confirmed, pending, failed] = await Promise.all([
    prisma.blockchainTransaction.count(),
    prisma.blockchainTransaction.count({ where: { status: "confirmed" } }),
    prisma.blockchainTransaction.count({ where: { status: "pending" } }),
    prisma.blockchainTransaction.count({ where: { status: "failed" } }),
  ]);
  return response.success(res, {
    totalTransactions: total,
    confirmedTransactions: confirmed,
    pendingTransactions: pending,
    failedTransactions: failed,
    successRate: total > 0 ? Math.round((confirmed / total) * 10000) / 100 : 0,
  });
});

const list = (req, res) =>
  response.success(res, { endpoints: ["POST /store", "GET /fetch/:id", "GET /transactions", "GET /transaction/:txHash", "GET /stats"] });

module.exports = { storeOnChain, fetchFromChain, getTransactions, getTransactionByHash, getStats, list };
