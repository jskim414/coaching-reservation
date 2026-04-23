const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const ROOT_DIR = process.cwd();
const readEnv = (name, fallback = "") => {
  const value = process.env[name];
  if (value == null) {
    return fallback;
  }

  return String(value).trim();
};

module.exports = {
  ROOT_DIR,
  PORT: Number(readEnv("PORT", 4000)),
  DB_FILE: readEnv("DB_FILE", path.join(ROOT_DIR, "data", "app.db")),
  DATABASE_URL: readEnv("DATABASE_URL"),
  GOOGLE_CLIENT_ID: readEnv("GOOGLE_CLIENT_ID"),
  TELEGRAM_BOT_TOKEN: readEnv("TELEGRAM_BOT_TOKEN"),
  TELEGRAM_CHAT_ID: readEnv("TELEGRAM_CHAT_ID"),
  SOLAPI_API_KEY: readEnv("SOLAPI_API_KEY"),
  SOLAPI_API_SECRET: readEnv("SOLAPI_API_SECRET"),
  SOLAPI_SENDER: readEnv("SOLAPI_SENDER"),
  SMS_ENABLED: readEnv("SMS_ENABLED").toLowerCase() === "true",
  ADMIN_ALLOWLIST_EMAIL: readEnv("ADMIN_ALLOWLIST_EMAIL", "admin@example.com"),
  CONTACT_PHONE: readEnv("CONTACT_PHONE", "01000000000"),
  SESSION_COOKIE_NAME: readEnv("SESSION_COOKIE_NAME", "coach_admin_session"),
  SESSION_SECRET: readEnv("SESSION_SECRET", "change-this-session-secret"),
  SESSION_MAX_AGE_MS: Number(readEnv("SESSION_MAX_AGE_MS", 1000 * 60 * 60 * 12)),
};
