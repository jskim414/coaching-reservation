const express = require("express");

const asyncHandler = require("../utils/async-handler");
const {
  createBooking,
  getPublicBooking,
  getPublicBookingByPassword,
  getService,
  getSlot,
  listServices,
  listSlots,
  searchPublicBookings,
} = require("../services/booking.service");

const router = express.Router();

router.get("/services", asyncHandler(async (_req, res) => {
  res.json({
    ok: true,
    items: await listServices(),
  });
}));

router.get("/services/:serviceId", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    item: await getService(Number(req.params.serviceId)),
  });
}));

router.get("/slots", asyncHandler(async (req, res) => {
  const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;

  res.json({
    ok: true,
    items: await listSlots({ serviceId }),
  });
}));

router.get("/slots/:slotId", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    item: await getSlot(Number(req.params.slotId)),
  });
}));

router.post("/bookings", asyncHandler(async (req, res) => {
  const booking = await createBooking(req.body);

  res.status(201).json({
    ok: true,
    item: booking,
  });
}));

router.post("/bookings/search", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    items: await searchPublicBookings(req.body || {}),
  });
}));

router.post("/bookings/:bookingId/public-access", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    item: await getPublicBookingByPassword(Number(req.params.bookingId), String(req.body.password || "")),
  });
}));

router.get("/bookings/:bookingId/public", asyncHandler(async (req, res) => {
  res.json({
    ok: true,
    item: await getPublicBooking(Number(req.params.bookingId)),
  });
}));

module.exports = router;
