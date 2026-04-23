const { createHttpError } = require("../utils/errors");
const { getAuthenticatedAdmin } = require("../services/auth.service");

async function requireAdmin(req, _res, next) {
  try {
    const admin = await getAuthenticatedAdmin(req);

    if (!admin) {
      return next(createHttpError(401, "Authentication required"));
    }

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = requireAdmin;
