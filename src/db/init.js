const db = require("./index");
const { ADMIN_ALLOWLIST_EMAIL } = require("../config/env");

const LEGACY_DUMMY_EMAILS = new Set([
  "hong@example.com",
  "test@example.com",
  "apitest@example.com",
  "order01@example.com",
  "order01b@example.com",
  "order01c@example.com",
]);
const DEFAULT_OPERATION_SETTINGS = {
  payment_account_bank: "예시은행",
  payment_account_number: "123-456-789012",
  payment_account_holder: "홍길동",
};

let initialized = false;
let initializePromise = null;

async function initializeDatabase() {
  if (initialized) {
    return;
  }

  if (!initializePromise) {
    initializePromise = runInitialization();
  }

  await initializePromise;
  initialized = true;
}

async function runInitialization() {
  if (db.isPostgres) {
    await initializePostgresSchema();
    await seedAdmins();
    await seedOperationSettings();
    return;
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('coaching', 'workshop')),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration_min INTEGER NOT NULL,
      price INTEGER NOT NULL,
      capacity_default INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      reserved_count INTEGER NOT NULL DEFAULT 0,
      is_open INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      organization TEXT,
      note TEXT,
      refund_bank TEXT,
      refund_account TEXT,
      refund_holder TEXT,
      booking_password_hash TEXT,
      status TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      confirmed_at TEXT,
      FOREIGN KEY (service_id) REFERENCES services(id),
      FOREIGN KEY (slot_id) REFERENCES slots(id)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_email TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      template_type TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );

    CREATE TABLE IF NOT EXISTS operation_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payment_account_bank TEXT NOT NULL,
      payment_account_number TEXT NOT NULL,
      payment_account_holder TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_slots_service_start ON slots(service_id, start_at);
    CREATE INDEX IF NOT EXISTS idx_bookings_slot_status ON bookings(slot_id, status);
    CREATE INDEX IF NOT EXISTS idx_message_logs_booking ON message_logs(booking_id, sent_at);
  `);

  await migrateBookingColumns();
  await backfillBookingColumnsFromLegacyNote();
  await cleanupLegacyDummyData();
  await reconcileSlotReservedCounts();
  await seedAdmins();
  await seedOperationSettings();
}

async function initializePostgresSchema() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('coaching', 'workshop')),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration_min INTEGER NOT NULL,
      price INTEGER NOT NULL,
      capacity_default INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS slots (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT NOT NULL REFERENCES services(id),
      start_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      capacity INTEGER NOT NULL,
      reserved_count INTEGER NOT NULL DEFAULT 0,
      is_open INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT NOT NULL REFERENCES services(id),
      slot_id BIGINT NOT NULL REFERENCES slots(id),
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      organization TEXT,
      note TEXT,
      refund_bank TEXT,
      refund_account TEXT,
      refund_holder TEXT,
      booking_password_hash TEXT,
      status TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL,
      confirmed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      google_email TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id BIGSERIAL PRIMARY KEY,
      booking_id BIGINT NOT NULL REFERENCES bookings(id),
      channel TEXT NOT NULL,
      template_type TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operation_settings (
      id INTEGER PRIMARY KEY,
      payment_account_bank TEXT NOT NULL,
      payment_account_number TEXT NOT NULL,
      payment_account_holder TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_slots_service_start ON slots(service_id, start_at);
    CREATE INDEX IF NOT EXISTS idx_bookings_slot_status ON bookings(slot_id, status);
    CREATE INDEX IF NOT EXISTS idx_message_logs_booking ON message_logs(booking_id, sent_at);
  `);
}

async function migrateBookingColumns() {
  if (db.isPostgres) {
    await db.exec(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_bank TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_account TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_holder TEXT;
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_password_hash TEXT;
    `);
    return;
  }

  await addSqliteColumnIfMissing("bookings", "refund_bank TEXT");
  await addSqliteColumnIfMissing("bookings", "refund_account TEXT");
  await addSqliteColumnIfMissing("bookings", "refund_holder TEXT");
  await addSqliteColumnIfMissing("bookings", "booking_password_hash TEXT");
}

async function addSqliteColumnIfMissing(tableName, columnDefinition) {
  const columnName = columnDefinition.trim().split(/\s+/)[0];
  const existingColumns = await db.all(`PRAGMA table_info(${tableName})`);

  if (existingColumns.some((column) => column.name === columnName)) {
    return;
  }

  await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
}

async function backfillBookingColumnsFromLegacyNote() {
  const rows = await db.all(`
    SELECT id, note, refund_bank, refund_account, refund_holder, booking_password_hash
    FROM bookings
    WHERE refund_bank IS NULL
       OR refund_account IS NULL
       OR refund_holder IS NULL
       OR booking_password_hash IS NULL
  `);

  for (const row of rows) {
    const metadata = parseLegacyBookingMetadata(row.note);
    const refundBank = row.refund_bank || metadata.refundBank || null;
    const refundAccount = row.refund_account || metadata.refundAccount || null;
    const refundHolder = row.refund_holder || metadata.refundHolder || null;
    const bookingPasswordHash = row.booking_password_hash || metadata.bookingPasswordHash || null;

    await db.run(`
      UPDATE bookings
      SET refund_bank = ?,
          refund_account = ?,
          refund_holder = ?,
          booking_password_hash = ?
      WHERE id = ?
    `, refundBank, refundAccount, refundHolder, bookingPasswordHash, row.id);
  }
}

async function cleanupLegacyDummyData() {
  if (db.isPostgres) {
    return;
  }

  const bookings = await db.all(`
    SELECT id, service_id, slot_id, name, email, organization, status
    FROM bookings
    ORDER BY id ASC
  `);

  const bookingIdsToDelete = bookings
    .filter((booking) => isLegacyDummyBooking(booking))
    .map((booking) => booking.id);

  await db.transaction(async () => {
    for (const bookingId of bookingIdsToDelete) {
      await db.run(`
        DELETE FROM message_logs
        WHERE booking_id = ?
      `, bookingId);

      await db.run(`
        DELETE FROM bookings
        WHERE id = ?
      `, bookingId);
    }

    const orphanedPastSlots = await db.all(`
      SELECT slots.id
      FROM slots
      LEFT JOIN bookings ON bookings.slot_id = slots.id
      WHERE bookings.id IS NULL
        AND slots.is_open = 0
        AND datetime(slots.start_at) < datetime('now')
    `);

    for (const slot of orphanedPastSlots) {
      await db.run(`
        DELETE FROM slots
        WHERE id = ?
      `, slot.id);
    }

    const orphanedInactiveWorkshopSlots = await db.all(`
      SELECT slots.id
      FROM slots
      INNER JOIN services ON services.id = slots.service_id
      LEFT JOIN bookings ON bookings.slot_id = slots.id
      WHERE services.name = '그룹 워크샵'
        AND services.is_active = 0
        AND bookings.id IS NULL
    `);

    for (const slot of orphanedInactiveWorkshopSlots) {
      await db.run(`
        DELETE FROM slots
        WHERE id = ?
      `, slot.id);
    }

    const removableServices = await db.all(`
      SELECT services.id
      FROM services
      LEFT JOIN slots ON slots.service_id = services.id
      LEFT JOIN bookings ON bookings.service_id = services.id
      WHERE services.name = '그룹 워크샵'
        AND services.is_active = 0
      GROUP BY services.id
      HAVING COUNT(DISTINCT slots.id) = 0
         AND COUNT(DISTINCT bookings.id) = 0
    `);

    for (const service of removableServices) {
      await db.run(`
        DELETE FROM services
        WHERE id = ?
      `, service.id);
    }
  });
}

function isLegacyDummyBooking(booking) {
  const email = String(booking.email || "").trim().toLowerCase();
  const name = String(booking.name || "").trim().toLowerCase();
  const organization = String(booking.organization || "").trim().toLowerCase();

  if (LEGACY_DUMMY_EMAILS.has(email)) {
    return true;
  }

  if (name.includes("test") || name.includes("api") || name.includes("order01")) {
    return true;
  }

  if (organization === "qa") {
    return true;
  }

  if (booking.status === "cancelled") {
    if (name.includes("테스트") || name.includes("텔레그램")) {
      return true;
    }

    if (name.includes("?")) {
      return true;
    }

    if (booking.service_id === 2) {
      return true;
    }
  }

  return false;
}

async function reconcileSlotReservedCounts() {
  const slots = await db.all(`
    SELECT
      slots.id,
      slots.capacity,
      services.type AS service_type
    FROM slots
    INNER JOIN services ON services.id = slots.service_id
    ORDER BY slots.id ASC
  `);

  const bookingsBySlot = await db.all(`
    SELECT slot_id, status
    FROM bookings
    ORDER BY id ASC
  `);

  const bookingsMap = new Map();

  bookingsBySlot.forEach((booking) => {
    const items = bookingsMap.get(booking.slot_id) || [];
    items.push(booking);
    bookingsMap.set(booking.slot_id, items);
  });

  for (const slot of slots) {
    const bookings = bookingsMap.get(slot.id) || [];
    const heldCount = bookings.filter((booking) => {
      if (booking.status === "confirmed") {
        return true;
      }

      return slot.service_type === "coaching" &&
        slot.capacity === 1 &&
        (booking.status === "requested" || booking.status === "payment_pending");
    }).length;

    await db.run(`
      UPDATE slots
      SET reserved_count = ?
      WHERE id = ?
    `, Math.min(heldCount, slot.capacity), slot.id);
  }
}

function parseLegacyBookingMetadata(value) {
  if (!value) {
    return {
      refundBank: null,
      refundAccount: null,
      refundHolder: null,
      bookingPasswordHash: null,
    };
  }

  try {
    const parsed = JSON.parse(value);

    if (parsed && typeof parsed === "object") {
      return {
        refundBank: normalizeOptionalText(parsed.refund_bank),
        refundAccount: normalizeOptionalText(parsed.refund_account),
        refundHolder: normalizeOptionalText(parsed.refund_holder),
        bookingPasswordHash: normalizeOptionalText(parsed.booking_password_hash),
      };
    }
  } catch (_error) {
    return {
      refundBank: null,
      refundAccount: null,
      refundHolder: null,
      bookingPasswordHash: null,
    };
  }

  return {
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

async function seedAdmins() {
  const normalizedAdminEmail = normalizeAdminEmail(ADMIN_ALLOWLIST_EMAIL);

  if (!normalizedAdminEmail) {
    return;
  }

  await db.run(`
    DELETE FROM admins
    WHERE lower(trim(google_email)) = lower(?)
      AND google_email <> ?
  `, normalizedAdminEmail, normalizedAdminEmail);

  await db.run(`
    INSERT INTO admins (google_email)
    VALUES (?)
    ON CONFLICT(google_email) DO NOTHING
  `, normalizedAdminEmail);
}

function normalizeAdminEmail(value) {
  if (value == null) {
    return "";
  }

  return String(value).trim().toLowerCase();
}

async function seedOperationSettings() {
  await db.run(`
    INSERT INTO operation_settings (
      id,
      payment_account_bank,
      payment_account_number,
      payment_account_holder,
      updated_at
    )
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO NOTHING
  `, DEFAULT_OPERATION_SETTINGS.payment_account_bank, DEFAULT_OPERATION_SETTINGS.payment_account_number, DEFAULT_OPERATION_SETTINGS.payment_account_holder);
}

module.exports = {
  initializeDatabase,
};
