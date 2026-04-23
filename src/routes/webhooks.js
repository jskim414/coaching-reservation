const express = require("express");

const asyncHandler = require("../utils/async-handler");
const { updateLatestMessageLog } = require("../services/message-log.service");

const router = express.Router();

router.post("/solapi", asyncHandler(async (req, res) => {
  const bookingId = Number(req.body.bookingId || req.body?.metadata?.bookingId);
  const templateType = String(req.body.templateType || req.body?.metadata?.templateType || "");
  const status = String(req.body.status || req.body?.message?.status || "received");

  if (bookingId && templateType) {
    await updateLatestMessageLog({
      bookingId,
      channel: "sms",
      templateType,
      status,
    });
  }

  res.json({
    ok: true,
  });
}));

module.exports = router;
