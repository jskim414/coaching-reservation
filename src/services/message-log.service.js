const db = require("../db");
const { toIsoString } = require("../utils/date");

async function createMessageLog({ bookingId, channel, templateType, status }) {
  await db.run(`
    INSERT INTO message_logs (booking_id, channel, template_type, sent_at, status)
    VALUES (?, ?, ?, ?, ?)
  `, bookingId, channel, templateType, toIsoString(new Date()), status);
}

async function updateLatestMessageLog({ bookingId, channel, templateType, status }) {
  const row = await db.get(`
    SELECT id
    FROM message_logs
    WHERE booking_id = ?
      AND channel = ?
      AND template_type = ?
    ORDER BY id DESC
    LIMIT 1
  `, bookingId, channel, templateType);

  if (!row) {
    return false;
  }

  await db.run(`
    UPDATE message_logs
    SET status = ?, sent_at = ?
    WHERE id = ?
  `, status, toIsoString(new Date()), row.id);

  return true;
}

async function listMessageLogsByBooking(bookingId) {
  return db.all(`
    SELECT id, booking_id, channel, template_type, sent_at, status
    FROM message_logs
    WHERE booking_id = ?
    ORDER BY id DESC
  `, bookingId);
}

module.exports = {
  createMessageLog,
  listMessageLogsByBooking,
  updateLatestMessageLog,
};
