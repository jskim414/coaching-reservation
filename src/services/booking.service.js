const crypto = require("crypto");

const db = require("../db");
const { createMessageLog } = require("./message-log.service");
const { sendTelegramNewBooking } = require("./telegram.service");
const { sendConfirmedSms, sendPaymentPendingSms } = require("./sms.service");
const { createHttpError } = require("../utils/errors");
const { normalizePhone } = require("../utils/phone");
const { toIsoString } = require("../utils/date");

const BOOKING_STATUSES = new Set([
  "requested",
  "payment_pending",
  "confirmed",
  "cancelled",
  "expired",
]);
const EXPIRATION_WINDOW_MS = 12 * 60 * 60 * 1000;

async function listServices() {
  await expireStalePendingBookings();

  const now = toIsoString(new Date());

  return db.all(`
    SELECT id, type, name, description, duration_min, price, capacity_default, is_active
    FROM services
    WHERE is_active = 1
      AND EXISTS (
        SELECT 1
        FROM slots
        WHERE slots.service_id = services.id
          AND slots.is_open = 1
          AND slots.start_at > ?
          AND slots.capacity > slots.reserved_count
      )
    ORDER BY id ASC
  `, now);
}

async function getService(serviceId) {
  const service = await db.get(`
    SELECT id, type, name, description, duration_min, price, capacity_default, is_active
    FROM services
    WHERE id = ?
  `, serviceId);

  if (!service) {
    throw createHttpError(404, "Service not found");
  }

  return service;
}

async function listSlots({ serviceId }) {
  await expireStalePendingBookings();

  const params = [];
  const conditions = [
    "services.is_active = 1",
    "slots.is_open = 1",
    "slots.start_at > ?",
    "slots.capacity > slots.reserved_count",
  ];

  params.push(toIsoString(new Date()));

  if (serviceId) {
    conditions.push("slots.service_id = ?");
    params.push(serviceId);
  }

  return db.all(`
    SELECT
      slots.id,
      slots.service_id,
      slots.start_at,
      slots.end_at,
      slots.capacity,
      slots.reserved_count,
      slots.is_open,
      services.name AS service_name,
      services.type AS service_type
    FROM slots
    INNER JOIN services ON services.id = slots.service_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY slots.start_at ASC
  `, ...params);
}

async function getSlot(slotId) {
  const slot = await db.get(`
    SELECT
      slots.id,
      slots.service_id,
      slots.start_at,
      slots.end_at,
      slots.capacity,
      slots.reserved_count,
      slots.is_open,
      services.name AS service_name,
      services.type AS service_type,
      services.duration_min AS service_duration_min
    FROM slots
    INNER JOIN services ON services.id = slots.service_id
    WHERE slots.id = ?
  `, slotId);

  if (!slot) {
    throw createHttpError(404, "Slot not found");
  }

  return slot;
}

async function createBooking(payload) {
  await expireStalePendingBookings();

  const input = validateBookingPayload(payload);
  const note = serializeBookingNote({
    customerNote: input.note,
    adminMemo: null,
  });

  const { bookingId, service, slot } = await db.transaction(async () => {
    const service = await getService(input.serviceId);
    const slot = await getSlot(input.slotId);

    if (slot.service_id !== service.id) {
      throw createHttpError(400, "Slot does not belong to the selected service");
    }

    if (!service.is_active) {
      throw createHttpError(400, "Service is inactive");
    }

    if (!slot.is_open) {
      throw createHttpError(400, "Slot is closed");
    }

    if (new Date(slot.start_at).getTime() <= Date.now()) {
      throw createHttpError(400, "Slot is already in the past");
    }

    if (slot.reserved_count >= slot.capacity) {
      throw createHttpError(409, "Slot is already full");
    }

    const shouldHoldCapacity = doesStatusHoldCapacity("requested", service, slot);

    const bookingId = (await db.run(`
      INSERT INTO bookings (
        service_id,
        slot_id,
        name,
        email,
        phone,
        organization,
        note,
        refund_bank,
        refund_account,
        refund_holder,
        booking_password_hash,
        status,
        applied_at,
        confirmed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, NULL)
    `, service.id, slot.id, input.name, input.email, input.phone, input.organization, note, input.refundBank, input.refundAccount, input.refundHolder, hashBookingPassword(input.bookingPassword), toIsoString(new Date()))).lastInsertRowid;

    if (shouldHoldCapacity) {
      await db.run(`
        UPDATE slots
        SET reserved_count = reserved_count + 1
        WHERE id = ?
      `, slot.id);
    }

    return {
      bookingId: Number(bookingId),
      service,
      slot,
    };
  });

  const booking = await getBookingDetails(bookingId);

  await attemptMessage({
    bookingId: booking.id,
    channel: "telegram",
    templateType: "new_booking",
    action: () => sendTelegramNewBooking({ booking, service, slot }),
  });

  await attemptMessage({
    bookingId: booking.id,
    channel: "sms",
    templateType: "payment_pending",
    action: () => sendPaymentPendingSms({ booking, service, slot }),
  });

  return toPublicBooking(booking);
}

async function getPublicBooking(bookingId) {
  await expireStalePendingBookings();
  return toPublicBooking(await getBookingDetails(bookingId));
}

async function searchPublicBookings({ name, phone, contact }) {
  await expireStalePendingBookings();

  const normalizedName = String(name || "").trim();
  const normalizedPhone = normalizePhone(phone || contact);

  if (normalizedName.length < 2) {
    throw createHttpError(400, "name must be at least 2 characters");
  }

  if (normalizedPhone.length < 10) {
    throw createHttpError(400, "phone must contain at least 10 digits");
  }

  return db.all(`
    SELECT
      bookings.id,
      bookings.name,
      bookings.status,
      bookings.applied_at,
      services.name AS service_name,
      slots.start_at AS slot_start_at
    FROM bookings
    INNER JOIN services ON services.id = bookings.service_id
    INNER JOIN slots ON slots.id = bookings.slot_id
    WHERE lower(bookings.name) = lower(?)
      AND bookings.phone = ?
    ORDER BY bookings.id DESC
    LIMIT 20
  `, normalizedName, normalizedPhone);
}

async function getPublicBookingByPassword(bookingId, password) {
  await expireStalePendingBookings();

  const booking = await getBookingDetails(bookingId);

  if (!verifyBookingPassword(password, booking.booking_password_hash, booking.phone)) {
    throw createHttpError(403, "Reservation password is invalid");
  }

  return toPublicBooking(booking);
}

async function listAdminBookings({ status, serviceId, dateFrom, dateTo }) {
  await expireStalePendingBookings();

  const params = [];
  const conditions = ["1 = 1"];

  if (status) {
    conditions.push("bookings.status = ?");
    params.push(status);
  }

  if (serviceId) {
    conditions.push("bookings.service_id = ?");
    params.push(serviceId);
  }

  if (dateFrom) {
    conditions.push("date(bookings.applied_at) >= date(?)");
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push("date(bookings.applied_at) <= date(?)");
    params.push(dateTo);
  }

  const rows = await db.all(`
    SELECT
      bookings.id,
      bookings.service_id,
      bookings.slot_id,
      bookings.name,
      bookings.email,
      bookings.phone,
      bookings.organization,
      bookings.note,
      bookings.refund_bank,
      bookings.refund_account,
      bookings.refund_holder,
      bookings.booking_password_hash,
      bookings.status,
      bookings.applied_at,
      bookings.confirmed_at,
      services.name AS service_name,
      services.type AS service_type,
      slots.start_at AS slot_start_at,
      slots.end_at AS slot_end_at,
      slots.capacity AS slot_capacity
    FROM bookings
    INNER JOIN services ON services.id = bookings.service_id
    INNER JOIN slots ON slots.id = bookings.slot_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY bookings.id DESC
  `, ...params);

  return rows.map(mapBookingRow);
}

async function updateBookingStatus(bookingId, nextStatus) {
  await expireStalePendingBookings();

  if (!BOOKING_STATUSES.has(nextStatus)) {
    throw createHttpError(400, "Unsupported booking status");
  }

  const booking = await getBookingDetails(bookingId);

  if (booking.status === nextStatus) {
    return booking;
  }

  const slot = await getSlot(booking.slot_id);
  const service = await getService(booking.service_id);
  const holdsCapacityBefore = doesStatusHoldCapacity(booking.status, service, slot);
  const holdsCapacityAfter = doesStatusHoldCapacity(nextStatus, service, slot);

  if (!holdsCapacityBefore && holdsCapacityAfter && slot.reserved_count >= slot.capacity) {
    throw createHttpError(409, "Slot is already full");
  }

  await db.transaction(async () => {
    const confirmedAt = nextStatus === "confirmed" ? toIsoString(new Date()) : null;

    await db.run(`
      UPDATE bookings
      SET status = ?, confirmed_at = ?
      WHERE id = ?
    `, nextStatus, confirmedAt, bookingId);

    if (!holdsCapacityBefore && holdsCapacityAfter) {
      await db.run(`
        UPDATE slots
        SET reserved_count = reserved_count + 1
        WHERE id = ?
      `, slot.id);
    }

    if (holdsCapacityBefore && !holdsCapacityAfter) {
      await db.run(`
        UPDATE slots
        SET reserved_count = CASE WHEN reserved_count > 0 THEN reserved_count - 1 ELSE 0 END
        WHERE id = ?
      `, slot.id);
    }
  });

  const updatedBooking = await getBookingDetails(bookingId);

  if (nextStatus === "confirmed") {
    await attemptMessage({
      bookingId,
      channel: "sms",
      templateType: "confirmed",
      action: () => sendConfirmedSms({ booking: updatedBooking, service, slot }),
    });
  }

  return updatedBooking;
}

async function updateBookingMemo(bookingId, memo) {
  const booking = await getBookingDetails(bookingId);
  const adminMemo = normalizeOptionalText(memo);

  if (adminMemo && adminMemo.length > 1000) {
    throw createHttpError(400, "memo must be 1000 characters or fewer");
  }

  await db.run(`
    UPDATE bookings
    SET note = ?
    WHERE id = ?
  `, serializeBookingNote({
    customerNote: booking.customer_note,
    adminMemo,
  }), bookingId);

  return getBookingDetails(bookingId);
}

async function deleteAdminBooking(bookingId) {
  await expireStalePendingBookings();
  return (await deleteBookingsByIds([bookingId]))[0] || null;
}

async function bulkDeleteAdminBookings(bookingIds) {
  await expireStalePendingBookings();

  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    throw createHttpError(400, "bookingIds is required");
  }

  const normalizedIds = [...new Set(bookingIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];

  if (normalizedIds.length === 0) {
    throw createHttpError(400, "bookingIds is required");
  }

  return deleteBookingsByIds(normalizedIds);
}

async function getBookingDetails(bookingId) {
  const row = await db.get(`
    SELECT
      bookings.id,
      bookings.service_id,
      bookings.slot_id,
      bookings.name,
      bookings.email,
      bookings.phone,
      bookings.organization,
      bookings.note,
      bookings.refund_bank,
      bookings.refund_account,
      bookings.refund_holder,
      bookings.booking_password_hash,
      bookings.status,
      bookings.applied_at,
      bookings.confirmed_at,
      services.name AS service_name,
      services.type AS service_type,
      slots.start_at AS slot_start_at,
      slots.end_at AS slot_end_at,
      slots.capacity AS slot_capacity
    FROM bookings
    INNER JOIN services ON services.id = bookings.service_id
    INNER JOIN slots ON slots.id = bookings.slot_id
    WHERE bookings.id = ?
  `, bookingId);

  if (!row) {
    throw createHttpError(404, "Booking not found");
  }

  return mapBookingRow(row);
}

async function attemptMessage({ bookingId, channel, templateType, action }) {
  try {
    const result = await action();
    await createMessageLog({
      bookingId,
      channel,
      templateType,
      status: result.status,
    });
  } catch (error) {
    console.error(`[message:${channel}:${templateType}] booking=${bookingId} ${error.message}`);
    await createMessageLog({
      bookingId,
      channel,
      templateType,
      status: "failed",
    });
  }
}

async function deleteBookingsByIds(bookingIds) {
  const deletedItems = [];

  for (const bookingId of bookingIds) {
    deletedItems.push(await getBookingDetails(bookingId));
  }

  await db.transaction(async () => {
    for (const booking of deletedItems) {
      if (doesStatusHoldCapacity(booking.status, booking, booking)) {
        await db.run(`
          UPDATE slots
          SET reserved_count = CASE WHEN reserved_count > 0 THEN reserved_count - 1 ELSE 0 END
          WHERE id = ?
        `, booking.slot_id);
      }

      await db.run(`
        DELETE FROM message_logs
        WHERE booking_id = ?
      `, booking.id);

      await db.run(`
        DELETE FROM bookings
        WHERE id = ?
      `, booking.id);
    }
  });

  return deletedItems;
}

async function expireStalePendingBookings() {
  const threshold = toIsoString(new Date(Date.now() - EXPIRATION_WINDOW_MS));
  const staleBookings = await db.all(`
    SELECT
      bookings.id,
      bookings.slot_id,
      services.type AS service_type,
      slots.capacity AS slot_capacity
    FROM bookings
    INNER JOIN services ON services.id = bookings.service_id
    INNER JOIN slots ON slots.id = bookings.slot_id
    WHERE bookings.status IN ('requested', 'payment_pending')
      AND bookings.applied_at <= ?
  `, threshold);

  const expiringItems = staleBookings.filter((booking) => doesStatusHoldCapacity("requested", booking, booking));

  if (expiringItems.length === 0) {
    return;
  }

  await db.transaction(async () => {
    for (const booking of expiringItems) {
      await db.run(`
        UPDATE bookings
        SET status = 'expired',
            confirmed_at = NULL
        WHERE id = ?
      `, booking.id);

      await db.run(`
        UPDATE slots
        SET reserved_count = CASE WHEN reserved_count > 0 THEN reserved_count - 1 ELSE 0 END
        WHERE id = ?
      `, booking.slot_id);
    }
  });
}

function doesStatusHoldCapacity(status, service, slot) {
  const serviceType = service.type || service.service_type;
  const slotCapacity = Number(slot.capacity ?? slot.slot_capacity);

  if (status === "confirmed") {
    return true;
  }

  return (
    (status === "requested" || status === "payment_pending") &&
    serviceType === "coaching" &&
    slotCapacity === 1
  );
}

function mapBookingRow(row) {
  const metadata = parseBookingNote(row.note);

  return {
    ...row,
    note: metadata.customerNote,
    customer_note: metadata.customerNote,
    admin_memo: metadata.adminMemo,
    refund_bank: normalizeOptionalText(row.refund_bank) || metadata.refundBank,
    refund_account: normalizeOptionalText(row.refund_account) || metadata.refundAccount,
    refund_holder: normalizeOptionalText(row.refund_holder) || metadata.refundHolder,
    booking_password_hash: normalizeOptionalText(row.booking_password_hash) || metadata.bookingPasswordHash,
    has_booking_password: Boolean(normalizeOptionalText(row.booking_password_hash) || metadata.bookingPasswordHash),
  };
}

function toPublicBooking(booking) {
  return {
    id: booking.id,
    service_id: booking.service_id,
    slot_id: booking.slot_id,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    organization: booking.organization,
    note: booking.customer_note,
    status: booking.status,
    applied_at: booking.applied_at,
    confirmed_at: booking.confirmed_at,
    service_name: booking.service_name,
    slot_start_at: booking.slot_start_at,
    slot_end_at: booking.slot_end_at,
  };
}

function parseBookingNote(value) {
  if (!value) {
    return getEmptyBookingMetadata();
  }

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object") {
      return {
        customerNote: normalizeOptionalText(parsed.customer_note),
        adminMemo: normalizeOptionalText(parsed.admin_memo),
        refundBank: normalizeOptionalText(parsed.refund_bank),
        refundAccount: normalizeOptionalText(parsed.refund_account),
        refundHolder: normalizeOptionalText(parsed.refund_holder),
        bookingPasswordHash: normalizeOptionalText(parsed.booking_password_hash),
      };
    }
  } catch (_error) {
    return {
      ...getEmptyBookingMetadata(),
      customerNote: normalizeOptionalText(value),
    };
  }

  return {
    ...getEmptyBookingMetadata(),
    customerNote: normalizeOptionalText(value),
  };
}

function serializeBookingNote({ customerNote, adminMemo }) {
  const metadata = {
    customer_note: normalizeOptionalText(customerNote),
    admin_memo: normalizeOptionalText(adminMemo),
  };

  if (!Object.values(metadata).some(Boolean)) {
    return null;
  }

  return JSON.stringify(metadata);
}

function validateBookingPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError(400, "Request body is required");
  }

  const serviceId = Number(payload.serviceId);
  const slotId = Number(payload.slotId);
  const name = String(payload.name || "").trim();
  const email = normalizeOptionalText(payload.email);
  const phone = normalizePhone(payload.phone);
  const organization = normalizeOptionalText(payload.organization);
  const note = normalizeOptionalText(payload.note);
  const refundBank = normalizeOptionalText(payload.refundBank);
  const refundAccount = normalizeOptionalText(payload.refundAccount);
  const refundHolder = normalizeOptionalText(payload.refundHolder);
  const bookingPassword = String(payload.bookingPassword || "").trim();

  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw createHttpError(400, "serviceId is required");
  }

  if (!Number.isInteger(slotId) || slotId <= 0) {
    throw createHttpError(400, "slotId is required");
  }

  if (name.length < 2 || name.length > 60) {
    throw createHttpError(400, "name must be between 2 and 60 characters");
  }

  if (phone.length < 10 || phone.length > 13) {
    throw createHttpError(400, "phone must contain 10 to 13 digits");
  }

  if (!email) {
    throw createHttpError(400, "email is required");
  }

  if (!String(email).includes("@")) {
    throw createHttpError(400, "email format is invalid");
  }

  if (organization && organization.length > 120) {
    throw createHttpError(400, "organization must be 120 characters or fewer");
  }

  if (note && note.length > 1000) {
    throw createHttpError(400, "note must be 1000 characters or fewer");
  }

  if (!refundBank || !refundAccount || !refundHolder) {
    throw createHttpError(400, "refund account information is required");
  }

  if (refundBank.length > 60) {
    throw createHttpError(400, "refundBank must be 60 characters or fewer");
  }

  if (refundAccount.length > 60) {
    throw createHttpError(400, "refundAccount must be 60 characters or fewer");
  }

  if (refundHolder.length > 60) {
    throw createHttpError(400, "refundHolder must be 60 characters or fewer");
  }

  if (!/^\d{4}$/.test(bookingPassword)) {
    throw createHttpError(400, "bookingPassword must be exactly 4 digits");
  }

  return {
    serviceId,
    slotId,
    name,
    email,
    phone,
    organization,
    note,
    refundBank,
    refundAccount,
    refundHolder,
    bookingPassword,
  };
}

function hashBookingPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyBookingPassword(password, storedHash, phone) {
  const normalizedPassword = String(password || "");

  if (!/^\d{4}$/.test(normalizedPassword)) {
    return false;
  }

  if (!storedHash) {
    return normalizePhone(phone).slice(-4) === normalizedPassword;
  }

  const [salt, hash] = String(storedHash).split(":");

  if (!salt || !hash) {
    return false;
  }

  const expectedHash = crypto.scryptSync(normalizedPassword, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expectedHash, "hex"));
}

function getEmptyBookingMetadata() {
  return {
    customerNote: null,
    adminMemo: null,
    refundBank: null,
    refundAccount: null,
    refundHolder: null,
    bookingPasswordHash: null,
  };
}

function normalizeOptionalText(value) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

module.exports = {
  bulkDeleteAdminBookings,
  createBooking,
  deleteAdminBooking,
  getBookingDetails,
  getPublicBooking,
  getPublicBookingByPassword,
  getService,
  getSlot,
  listAdminBookings,
  listServices,
  listSlots,
  searchPublicBookings,
  updateBookingMemo,
  updateBookingStatus,
};
