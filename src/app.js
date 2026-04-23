const path = require("path");
const express = require("express");

const { initializeDatabase } = require("./db/init");
const authRoutes = require("./routes/auth");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const webhookRoutes = require("./routes/webhooks");
const { formatErrorResponse } = require("./utils/errors");

const app = express();

let initializationPromise = null;

function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = initializeDatabase();
  }

  return initializationPromise;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use(async (req, _res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (error) {
    next(error);
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhooks", webhookRoutes);

app.get("*", (req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const message = err.message || "Internal server error";

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(formatErrorResponse({
    status,
    message,
    code: err.code,
    details: err.details,
  }));
});

module.exports = app;
