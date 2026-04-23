const DEFAULT_ERROR_CODES = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  500: "INTERNAL_SERVER_ERROR",
};

function createHttpError(status, message, options = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = options.code || DEFAULT_ERROR_CODES[status] || "REQUEST_ERROR";
  error.details = options.details || null;
  return error;
}

function formatErrorResponse(error) {
  const status = error.status || 500;
  const message = error.message || "Internal server error";
  const code = error.code || DEFAULT_ERROR_CODES[status] || "REQUEST_ERROR";

  return {
    ok: false,
    message,
    error: {
      code,
      message,
      details: error.details || null,
    },
  };
}

module.exports = {
  createHttpError,
  formatErrorResponse,
};
