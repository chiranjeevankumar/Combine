// Role-based access control. The first matching rule grants access.
const ROLE_HIERARCHY = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
  STARTUP: 2,
  INVESTOR: 1,
};

const hasRole = (userRole, minRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return userLevel >= requiredLevel;
};

// Accepts a list of allowed roles OR a minimum-role string.
const permit = (...allowed) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  const role = req.user.role;
  const ok = allowed.some((rule) => {
    if (typeof rule === "string") return hasRole(role, rule);
    return false;
  });
  if (!ok) {
    return res.status(403).json({
      success: false,
      message: `Forbidden: '${role}' role cannot access this resource.`,
    });
  }
  next();
};

module.exports = { permit, hasRole, ROLE_HIERARCHY };
