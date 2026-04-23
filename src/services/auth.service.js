const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const db = require("../db");
const {
  GOOGLE_CLIENT_ID,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  SESSION_SECRET,
} = require("../config/env");
const { createHttpError } = require("../utils/errors");

const googleClient = new OAuth2Client();

async function getAdminByEmail(email) {
  return db.get(`
    SELECT id, google_email
    FROM admins
    WHERE lower(trim(google_email)) = lower(?)
  `, String(email || "").trim().toLowerCase());
}

async function authenticateGoogleCredential(credential) {
  if (!GOOGLE_CLIENT_ID) {
    throw createHttpError(503, "GOOGLE_CLIENT_ID is not configured", {
      code: "GOOGLE_AUTH_DISABLED",
    });
  }

  if (!credential || typeof credential !== "string") {
    throw createHttpError(400, "Google credential is required", {
      code: "GOOGLE_CREDENTIAL_REQUIRED",
    });
  }

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (_error) {
    throw createHttpError(401, "Google ID token is invalid", {
      code: "GOOGLE_TOKEN_INVALID",
    });
  }

  const email = String(payload?.email || "").trim().toLowerCase();

  if (!email) {
    throw createHttpError(401, "Google account email is missing", {
      code: "GOOGLE_EMAIL_MISSING",
    });
  }

  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw createHttpError(401, "Google account email is not verified", {
      code: "GOOGLE_EMAIL_NOT_VERIFIED",
    });
  }

  const admin = await getAdminByEmail(email);

  if (!admin) {
    throw createHttpError(403, "Admin access denied", {
      code: "ADMIN_ACCESS_DENIED",
    });
  }

  return admin;
}

async function getAuthenticatedAdmin(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionValue = cookies[SESSION_COOKIE_NAME];

  if (!sessionValue) {
    return null;
  }

  try {
    const session = decodeSessionValue(sessionValue);

    if (!session.email || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return getAdminByEmail(session.email);
  } catch (_error) {
    return null;
  }
}

function attachAdminSession(res, admin) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  const sessionValue = encodeSessionValue({
    email: admin.google_email,
    exp: Math.floor(expiresAt / 1000),
    iat: Math.floor(Date.now() / 1000),
  });

  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
    path: "/",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
  }));
}

function clearAdminSession(res) {
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
  }));
}

function encodeSessionValue(payload) {
  const body = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const signature = signValue(body);
  return `${body}.${signature}`;
}

function decodeSessionValue(value) {
  const [body, signature] = String(value || "").split(".");

  if (!body || !signature) {
    throw new Error("Invalid session cookie format");
  }

  const expectedSignature = signValue(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error("Invalid session cookie signature");
  }

  return JSON.parse(fromBase64Url(body).toString("utf8"));
}

function signValue(value) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge != null) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((result, part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex <= 0) {
        return result;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      result[key] = decodeURIComponent(value);
      return result;
    }, {});
}

function toBase64Url(buffer) {
  return buffer.toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url");
}

module.exports = {
  attachAdminSession,
  authenticateGoogleCredential,
  clearAdminSession,
  getAuthenticatedAdmin,
};
