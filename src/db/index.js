const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("async_hooks");
const { DatabaseSync } = require("node:sqlite");
const { Pool, types } = require("pg");

const { DATABASE_URL, DB_FILE } = require("../config/env");

types.setTypeParser(20, (value) => Number(value));

const isPostgres = Boolean(DATABASE_URL);
const txStore = new AsyncLocalStorage();

let sqliteDb = null;
let pool = null;

if (process.env.VERCEL === "1" && !isPostgres) {
  throw new Error("DATABASE_URL is required for Vercel deployments");
}

if (isPostgres) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
  });
} else {
  const dataDir = path.dirname(DB_FILE);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  sqliteDb = new DatabaseSync(DB_FILE);
  sqliteDb.exec("PRAGMA foreign_keys = ON;");
  sqliteDb.exec("PRAGMA journal_mode = WAL;");
}

function getPgExecutor() {
  const context = txStore.getStore();
  return context?.client || pool;
}

function toPgSql(sql) {
  let index = 0;
  return String(sql).replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

function normalizeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return value;
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") {
    return row;
  }

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])
  );
}

function trimSql(sql) {
  return String(sql).trim().replace(/;$/, "");
}

async function exec(sql) {
  if (isPostgres) {
    await getPgExecutor().query(String(sql));
    return;
  }

  sqliteDb.exec(String(sql));
}

async function get(sql, ...params) {
  if (isPostgres) {
    const result = await getPgExecutor().query(toPgSql(sql), params);
    return normalizeRow(result.rows[0]);
  }

  return normalizeRow(sqliteDb.prepare(String(sql)).get(...params));
}

async function all(sql, ...params) {
  if (isPostgres) {
    const result = await getPgExecutor().query(toPgSql(sql), params);
    return result.rows.map(normalizeRow);
  }

  return sqliteDb.prepare(String(sql)).all(...params).map(normalizeRow);
}

async function run(sql, ...params) {
  const trimmedSql = trimSql(sql);

  if (isPostgres) {
    const shouldReturnId = /^\s*insert\b/i.test(trimmedSql) && !/\breturning\b/i.test(trimmedSql);
    const queryText = shouldReturnId ? `${trimmedSql} RETURNING id` : trimmedSql;
    const result = await getPgExecutor().query(toPgSql(queryText), params);

    return {
      changes: result.rowCount || 0,
      lastInsertRowid: result.rows[0]?.id || null,
    };
  }

  const result = sqliteDb.prepare(trimmedSql).run(...params);

  return {
    changes: Number(result.changes || 0),
    lastInsertRowid: result.lastInsertRowid == null ? null : Number(result.lastInsertRowid),
  };
}

async function transaction(callback) {
  if (isPostgres) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await txStore.run({ client }, callback);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  sqliteDb.exec("BEGIN");

  try {
    const result = await callback();
    sqliteDb.exec("COMMIT");
    return result;
  } catch (error) {
    sqliteDb.exec("ROLLBACK");
    throw error;
  }
}

module.exports = {
  all,
  exec,
  get,
  isPostgres,
  run,
  transaction,
};
