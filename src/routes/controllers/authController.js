const authService = require("../../authService");

function logUnexpectedError(operation, error) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  let message = error instanceof Error ? error.message : String(error);
  for (const secret of [process.env.DATABASE_URL, process.env.JWT_SECRET]) {
    if (secret) {
      message = message.replaceAll(secret, "[redacted]");
    }
  }
  message = message
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[redacted database URL]")
    .replace(/\b(passwordHash|password|JWT_SECRET|DATABASE_URL)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^,\s}]+)/gi, "$1=[redacted]");

  const name = error instanceof Error ? error.name : "UnknownError";
  const code = error && typeof error.code === "string" ? ` (${error.code})` : "";
  console.error(`[auth] ${operation} failed: ${name}${code}: ${message}`);

  if (error instanceof Error && error.stack) {
    const frames = error.stack.split("\n").slice(1).join("\n");
    if (frames) {
      console.error(frames);
    }
  }
}

function sendError(response, error) {
  if (error.status && error.code) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  if (error.code === "P2002") {
    return response.status(409).json({
      error: { code: "EMAIL_ALREADY_REGISTERED", message: "An account with this email already exists." },
    });
  }

  logUnexpectedError("authentication request", error);
  return response.status(500).json({
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." },
  });
}

async function register(request, response) {
  try {
    const user = await authService.registerPatient(request.body);
    return response.status(201).json({
      message: "Registration successful",
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    return sendError(response, error);
  }
}

async function login(request, response) {
  try {
    const result = await authService.login(request.body);
    return response.status(200).json(result);
  } catch (error) {
    return sendError(response, error);
  }
}

function me(request, response) {
  return response.status(200).json({
    user: { id: request.user.id, role: request.user.role },
  });
}

module.exports = { register, login, me };
