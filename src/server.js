// === TEMPORARY CRASH LOGGING (START) ===
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT", e);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error("UNHANDLED", e);
  process.exit(1);
});
process.on("exit", (code) => {
  console.log("Process exiting with code", code);
});
// === TEMPORARY CRASH LOGGING (END) ===

require("dotenv").config();

const app = require("./app");
const { getPrismaClient } = require("./authService");

const port = Number(process.env.PORT) || 3000;

function sanitizeErrorMessage(error) {
  let message = error instanceof Error ? error.message : String(error);
  if (process.env.DATABASE_URL) {
    message = message.replaceAll(process.env.DATABASE_URL, "[redacted database URL]");
  }
  if (process.env.JWT_SECRET) {
    message = message.replaceAll(process.env.JWT_SECRET, "[redacted secret]");
  }
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[redacted database URL]")
    .replace(/\b(passwordHash|password|JWT_SECRET|DATABASE_URL)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^,\s}]+)/gi, "$1=[redacted]");
}

async function verifyDatabaseConnection() {
  try {
    const prisma = await getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connection established successfully.");
  } catch (error) {
    console.error("Database connection failed on startup:", sanitizeErrorMessage(error));
  }
}

const server = app.listen(port, () => {
  console.log(`Aido Care API listening on port ${port}`);
  verifyDatabaseConnection();
});

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
});
