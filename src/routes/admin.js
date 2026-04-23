const express = require("express");

const asyncHandler = require("../utils/async-handler");
const requireAdmin = require("../middleware/admin");
const {
  bulkDeleteAdminBookings,
  deleteAdminBooking,
  getBookingDetails,
  listAdminBookings,
  updateBookingMemo,
  updateBookingStatus,
} = require("../services/booking.service");
const {
  createAdminService,
  createAdminSlot,
  deleteAdminService,
  deleteAdminSlot,
  getAdminService,
  getAdminSlot,
  listAdminServices,
  listAdminSlots,
  updateAdminService,
  updateAdminSlot,
} = require("../services/admin-management.service");
const { listMessageLogsByBooking } = require("../services/message-log.service");
const { getOperationSettings, updateOperationSettings } = require("../services/operation-settings.service");

const router = express.Router();

router.use(requireAdmin);

function sanitizeBooking(item) {
  if (!item) {
    return item;
  }

  const { booking_password_hash, ...safeItem } = item;
  return safeItem;
}

router.get("/services", asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    items: await listAdminServices(),
  });
}));

router.get("/settings/operation", asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    item: await getOperationSettings(),
  });
}));

router.patch("/settings/operation", asyncHandler(async (req, res) => {
  const item = await updateOperationSettings(req.body);

  res.json({
    ok: true,
    item,
  });
}));

router.get("/services/:serviceId", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    item: await getAdminService(Number(req.params.serviceId)),
  });
}));

router.post("/services", asyncHandler(async (req, res) => {
  const service = await createAdminService(req.body);

  res.status(201).json({
    ok: true,
    item: service,
  });
}));

router.patch("/services/:serviceId", asyncHandler(async (req, res) => {
  const service = await updateAdminService(Number(req.params.serviceId), req.body);

  res.json({
    ok: true,
    item: service,
  });
}));

router.delete("/services/:serviceId", asyncHandler(async (req, res) => {
  const service = await deleteAdminService(Number(req.params.serviceId));

  res.json({
    ok: true,
    item: service,
  });
}));

router.get("/slots", asyncHandler(async (req, res) => {
  const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;

  res.json({
    ok: true,
    items: await listAdminSlots({ serviceId }),
  });
}));

router.get("/slots/:slotId", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    item: await getAdminSlot(Number(req.params.slotId)),
  });
}));

router.post("/slots", asyncHandler(async (req, res) => {
  const slot = await createAdminSlot(req.body);

  res.status(201).json({
    ok: true,
    item: slot,
  });
}));

router.patch("/slots/:slotId", asyncHandler(async (req, res) => {
  const slot = await updateAdminSlot(Number(req.params.slotId), req.body);

  res.json({
    ok: true,
    item: slot,
  });
}));

router.delete("/slots/:slotId", asyncHandler(async (req, res) => {
  const slot = await deleteAdminSlot(Number(req.params.slotId));

  res.json({
    ok: true,
    item: slot,
  });
}));

router.get("/bookings", asyncHandler(async (req, res) => {
  const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : undefined;
  const dateTo = req.query.dateTo ? String(req.query.dateTo) : undefined;

  res.json({
    ok: true,
    items: (await listAdminBookings({ serviceId, status, dateFrom, dateTo })).map(sanitizeBooking),
  });
}));

router.post("/bookings/bulk-delete", asyncHandler(async (req, res) => {
  const items = await bulkDeleteAdminBookings(req.body.bookingIds);

  res.json({
    ok: true,
    items: items.map(sanitizeBooking),
  });
}));

router.get("/bookings/:bookingId", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    item: sanitizeBooking(await getBookingDetails(Number(req.params.bookingId))),
  });
}));

router.delete("/bookings/:bookingId", asyncHandler(async (req, res) => {
  const item = await deleteAdminBooking(Number(req.params.bookingId));

  res.json({
    ok: true,
    item: sanitizeBooking(item),
  });
}));

router.patch("/bookings/:bookingId/status", asyncHandler(async (req, res) => {
  const booking = await updateBookingStatus(Number(req.params.bookingId), String(req.body.status || ""));

  res.json({
    ok: true,
    item: sanitizeBooking(booking),
  });
}));

router.patch("/bookings/:bookingId/memo", asyncHandler(async (req, res) => {
  const booking = await updateBookingMemo(Number(req.params.bookingId), req.body.memo);

  res.json({
    ok: true,
    item: sanitizeBooking(booking),
  });
}));

router.get("/bookings/:bookingId/message-logs", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    items: await listMessageLogsByBooking(Number(req.params.bookingId)),
  });
}));

module.exports = router;
