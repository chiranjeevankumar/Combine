// Ensures authenticated requests are scoped to the caller's organization.
const tenantScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  if (!req.user.organizationId) {
    return res.status(403).json({
      success: false,
      message: "You must belong to an organization to access this resource.",
    });
  }
  req.orgId = req.user.organizationId;
  next();
};

module.exports = tenantScope;
