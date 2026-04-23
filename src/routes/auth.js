const express = require("express");

const asyncHandler = require("../utils/async-handler");
const {
  attachAdminSession,
  authenticateGoogleCredential,
  clearAdminSession,
  getAuthenticatedAdmin,
} = require("../services/auth.service");

const router = express.Router();

router.post("/google", asyncHandler(async (req, res) => {
  const admin = await authenticateGoogleCredential(String(req.body.credential || ""));

  attachAdminSession(res, admin);

  res.json({
    ok: true,
    item: admin,
  });
}));

router.post("/logout", (_req, res) => {
  clearAdminSession(res);

  res.json({
    ok: true,
  });
});

router.get("/me", asyncHandler(async (req, res) => {
  const admin = await getAuthenticatedAdmin(req);

  if (!admin) {
    res.status(401).json({
      ok: false,
      message: "Authentication required",
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        details: null,
      },
    });
    return;
  }

  res.json({
    ok: true,
    item: admin,
  });
}));

module.exports = router;
