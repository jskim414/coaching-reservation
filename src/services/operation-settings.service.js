const db = require("../db");
const { createHttpError } = require("../utils/errors");
const { toIsoString } = require("../utils/date");

const DEFAULT_OPERATION_SETTINGS = {
  payment_account_bank: "예시은행",
  payment_account_number: "123-456-789012",
  payment_account_holder: "홍길동",
};

async function getOperationSettings() {
  const item = await db.get(`
    SELECT payment_account_bank, payment_account_number, payment_account_holder
    FROM operation_settings
    WHERE id = 1
  `);

  return {
    ...DEFAULT_OPERATION_SETTINGS,
    ...sanitizeSettingsObject(item),
  };
}

async function updateOperationSettings(payload) {
  if (!payload || typeof payload !== "object") {
    throw createHttpError(400, "Request body is required");
  }

  const paymentAccountBank = normalizeRequiredText(payload.payment_account_bank, "payment_account_bank");
  const paymentAccountNumber = normalizeRequiredText(payload.payment_account_number, "payment_account_number");
  const paymentAccountHolder = normalizeRequiredText(payload.payment_account_holder, "payment_account_holder");

  await db.run(`
    UPDATE operation_settings
    SET payment_account_bank = ?,
        payment_account_number = ?,
        payment_account_holder = ?,
        updated_at = ?
    WHERE id = 1
  `, paymentAccountBank, paymentAccountNumber, paymentAccountHolder, toIsoString(new Date()));

  return getOperationSettings();
}

function sanitizeSettingsObject(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return {
    payment_account_bank: normalizeOptionalText(value.payment_account_bank),
    payment_account_number: normalizeOptionalText(value.payment_account_number),
    payment_account_holder: normalizeOptionalText(value.payment_account_holder),
  };
}

function normalizeRequiredText(value, fieldName) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw createHttpError(400, `${fieldName} is required`);
  }

  if (normalized.length > 120) {
    throw createHttpError(400, `${fieldName} must be 120 characters or fewer`);
  }

  return normalized;
}

function normalizeOptionalText(value) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

module.exports = {
  getOperationSettings,
  updateOperationSettings,
};
