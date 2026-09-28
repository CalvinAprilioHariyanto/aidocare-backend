const jwt = require("jsonwebtoken");

const tokenOptions = {
  algorithms: ["HS256"],
  issuer: "aido-care",
  audience: "aido-care-api",
};
const validRoles = new Set(["PATIENT", "DOCTOR"]);

function sendAuthError(response, status, code, message) {
  return response.status(status).json({ error: { code, message } });
}

function authenticate(request, response, next) {
  const authorization = request.get("authorization");
  const match = authorization && authorization.match(/^Bearer\s+(\S+)$/i);

  if (!authorization) {
    return sendAuthError(response, 401, "AUTHENTICATION_REQUIRED", "A bearer token is required.");
  }

  if (!match) {
    return sendAuthError(response, 401, "INVALID_TOKEN", "The access token is invalid or expired.");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return sendAuthError(response, 500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred.");
  }

  try {
    const claims = jwt.verify(match[1], secret, tokenOptions);
    if (!claims || typeof claims !== "object" || typeof claims.userId !== "string" ||
        !validRoles.has(claims.role)) {
      return sendAuthError(response, 401, "INVALID_TOKEN", "The access token is invalid or expired.");
    }

    request.user = { id: claims.userId, role: claims.role };
    return next();
  } catch {
    return sendAuthError(response, 401, "INVALID_TOKEN", "The access token is invalid or expired.");
  }
}

function requireRole(role) {
  if (!validRoles.has(role)) {
    throw new TypeError("A valid user role is required.");
  }

  return (request, response, next) => {
    if (!request.user) {
      return sendAuthError(response, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }

    if (request.user.role !== role) {
      return sendAuthError(response, 403, "FORBIDDEN", "You do not have permission to access this resource.");
    }

    return next();
  };
}

module.exports = { authenticate, requireRole };