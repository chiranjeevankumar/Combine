const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/leadController");
const findCtrl = require("../controllers/findLeadsController");
const { protect } = require("../middleware/authMiddleware");
const tenantScope = require("../middleware/tenant");
const validate = require("../middleware/validate");
const {
  createLeadSchema,
  leadQuerySchema,
  updateLeadSchema,
} = require("../validations/leadValidation");
const { enforcePlanLimit } = require("../services/usageService");
const { permit } = require("../middleware/rbac");

router.use(protect, tenantScope);

router.get("/stats", ctrl.stats);
router.get("/", validate(leadQuerySchema, "query"), ctrl.getLeads);

// Find Leads Routes
router.post("/find", permit("OWNER", "ADMIN", "MEMBER"), findCtrl.findLeads);
router.get("/find/:jobId", permit("OWNER", "ADMIN", "MEMBER"), findCtrl.getFindLeadsStatus);
router.post("/find/:jobId/confirm", permit("OWNER", "ADMIN", "MEMBER"), findCtrl.confirmFindLeads);

router.get("/:id", ctrl.getLeadById);
router.post(
  "/",
  permit("OWNER", "ADMIN", "MEMBER"),
  enforcePlanLimit("leads", "leads"),
  validate(createLeadSchema),
  ctrl.createLead,
);
router.patch("/:id", permit("OWNER", "ADMIN", "MEMBER"), validate(updateLeadSchema), ctrl.updateLead);
router.delete("/:id", permit("OWNER", "ADMIN", "MEMBER"), ctrl.deleteLead);
router.post("/bulk", permit("OWNER", "ADMIN", "MEMBER"), ctrl.bulkUpdate);
router.post("/bulk-delete", permit("OWNER", "ADMIN"), ctrl.bulkDelete);

module.exports = router;
