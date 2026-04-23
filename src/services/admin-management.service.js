const db = require("../db");
const { createHttpError } = require("../utils/errors");
const { toIsoString } = require("../utils/date");

async function listAdminServices() {
  return db.all(`
    SELECT id, type, name, description, duration_min, price, capacity_default, is_active
    FROM services
    ORDER BY id ASC
  `);
}

async function createAdminService(payload) {
  const input = validateServicePayload(payload);

  const serviceId = (await db.run(`
    INSERT INTO services (type, name, description, duration_min, price, capacity_default, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, input.type, input.name, input.description, input.duration_min, input.price, input.capacity_default, input.is_active)).lastInsertRowid;

  return getAdminService(Number(serviceId));
}

async function updateAdminService(serviceId, payload) {
  const current = await getAdminService(serviceId);
  const input = validateServicePayload({
    ...current,
    ...payload,
  });

  await db.run(`
    UPDATE services
    SET type = ?, name = ?, description = ?, duration_min = ?, price = ?, capacity_default = ?, is_active = ?
    WHERE id = ?
  `, input.type, input.name, input.description, input.duration_min, input.price, input.capacity_default, input.is_active, serviceId);

  return getAdminService(serviceId);
}

async function deleteAdminService(serviceId) {
  const service = await getAdminService(serviceId);
  const slotCount = (await db.get(`
    SELECT COUNT(*) AS count
    FROM slots
    WHERE service_id = ?
  `, serviceId)).count;
  const bookingCount = (await db.get(`
    SELECT COUNT(*) AS count
    FROM bookings
    WHERE service_id = ?
  `, serviceId)).count;

  if (bookingCount > 0) {
    throw createHttpError(409, "This service has bookings and cannot be deleted");
  }

  if (slotCount > 0) {
    throw createHttpError(409, "Delete this service's slots first");
  }

  await db.run(`
    DELETE FROM services
    WHERE id = ?
  `, serviceId);

  return service;
}

async function listAdminSlots({ serviceId }) {
  const params = [];
  const conditions = ["1 = 1"];

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
      (
        SELECT COUNT(*)
        FROM bookings
        WHERE bookings.slot_id = slots.id
      ) AS booking_count
    FROM slots
    INNER JOIN services ON services.id = slots.service_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY slots.start_at ASC, slots.id ASC
  `, ...params);
}

async function createAdminSlot(payload) {
  const input = validateSlotPayload(payload);

  await getAdminService(input.service_id);

  const slotId = (await db.run(`
    INSERT INTO slots (service_id, start_at, end_at, capacity, reserved_count, is_open)
    VALUES (?, ?, ?, ?, 0, ?)
  `, input.service_id, input.start_at, input.end_at, input.capacity, input.is_open)).lastInsertRowid;

  return getAdminSlot(Number(slotId));
}

async function updateAdminSlot(slotId, payload) {
  const current = await getAdminSlot(slotId);
  const bookingCount = (await db.get(`
    SELECT COUNT(*) AS count
    FROM bookings
    WHERE slot_id = ?
  `, slotId)).count;

  const input = validateSlotPayload({
    ...current,
    ...payload,
    reserved_count: current.reserved_count,
  });

  if (bookingCount > 0 && current.service_id !== input.service_id) {
    throw createHttpError(409, "A slot with bookings cannot be moved to another service");
  }

  if (input.capacity < current.reserved_count) {
    throw createHttpError(409, "Capacity cannot be lower than the confirmed reservation count");
  }

  await getAdminService(input.service_id);

  await db.run(`
    UPDATE slots
    SET service_id = ?, start_at = ?, end_at = ?, capacity = ?, is_open = ?
    WHERE id = ?
  `, input.service_id, input.start_at, input.end_at, input.capacity, input.is_open, slotId);

  return getAdminSlot(slotId);
}

async function deleteAdminSlot(slotId) {
  const slot = await getAdminSlot(slotId);
  const bookingCount = (await db.get(`
    SELECT COUNT(*) AS count
    FROM bookings
    WHERE slot_id = ?
  `, slotId)).count;

  if (bookingCount > 0 || slot.reserved_count > 0) {
    throw createHttpError(409, "This slot has booking history and cannot be deleted");
  }

  await db.run(`
    DELETE FROM slots
    WHERE id = ?
  `, slotId);

  return slot;
}

async function getAdminService(serviceId) {
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

async function getAdminSlot(slotId) {
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
      (
        SELECT COUNT(*)
        FROM bookings
        WHERE bookings.slot_id = slots.id
      ) AS booking_count
    FROM slots
    INNER JOIN services ON services.id = slots.service_id
    WHERE slots.id = ?
  `, slotId);

  if (!slot) {
    throw createHttpError(404, "Slot not found");
  }

  return slot;
}

function validateServicePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError(400, "Request body is required");
  }

  const type = String(payload.type || "").trim();
  const name = String(payload.name || "").trim();
  const description = String(payload.description || "").trim();
  const durationMin = Number(payload.duration_min);
  const price = Number(payload.price);
  const capacityDefault = Number(payload.capacity_default);
  const isActive = toBooleanInt(payload.is_active);

  if (type !== "coaching" && type !== "workshop") {
    throw createHttpError(400, "type must be coaching or workshop");
  }

  if (name.length < 2) {
    throw createHttpError(400, "name must be at least 2 characters");
  }

  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    throw createHttpError(400, "duration_min must be a positive integer");
  }

  if (!Number.isInteger(price) || price < 0) {
    throw createHttpError(400, "price must be a non-negative integer");
  }

  if (!Number.isInteger(capacityDefault) || capacityDefault <= 0) {
    throw createHttpError(400, "capacity_default must be a positive integer");
  }

  return {
    type,
    name,
    description,
    duration_min: durationMin,
    price,
    capacity_default: capacityDefault,
    is_active: isActive,
  };
}

function validateSlotPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError(400, "Request body is required");
  }

  const serviceId = Number(payload.service_id ?? payload.serviceId);
  const capacity = Number(payload.capacity);
  const isOpen = toBooleanInt(payload.is_open);
  const startAt = parseIsoDate(payload.start_at ?? payload.startAt, "start_at is invalid");
  const endAt = parseIsoDate(payload.end_at ?? payload.endAt, "end_at is invalid");

  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw createHttpError(400, "service_id must be a positive integer");
  }

  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw createHttpError(400, "capacity must be a positive integer");
  }

  if (endAt.getTime() <= startAt.getTime()) {
    throw createHttpError(400, "end_at must be later than start_at");
  }

  return {
    service_id: serviceId,
    start_at: toIsoString(startAt),
    end_at: toIsoString(endAt),
    capacity,
    is_open: isOpen,
  };
}

function parseIsoDate(value, message) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    throw createHttpError(400, message);
  }

  return date;
}

function toBooleanInt(value) {
  return value === 0 || value === "0" || value === false ? 0 : 1;
}

module.exports = {
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
};
