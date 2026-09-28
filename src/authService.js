const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaPg } = require("@prisma/adapter-pg");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordHashCost = 12;
let prismaClientPromise;

class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function getPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!prismaClientPromise) {
    prismaClientPromise = import("../generated/prisma/client.ts").then(({ PrismaClient }) => {
      const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
      return new PrismaClient({ adapter });
    });
  }

  return prismaClientPromise;
}

function requiredString(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AuthError(400, "VALIDATION_ERROR", `${field} is required.`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AuthError(400, "VALIDATION_ERROR", `${field} is too long.`);
  }

  return normalized;
}

function requiredPassword(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AuthError(400, "VALIDATION_ERROR", "password is required.");
  }

  if (value.length > 128) {
    throw new AuthError(400, "INVALID_PASSWORD", "Password is too long.");
  }

  return value;
}

function validateRegistration(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AuthError(400, "VALIDATION_ERROR", "A JSON object is required.");
  }

  const firstName = requiredString(body.firstName, "firstName", 80);
  const lastName = requiredString(body.lastName, "lastName", 80);
  const email = requiredString(body.email, "email", 254).toLowerCase();
  const phoneNumber = requiredString(body.phoneNumber, "phoneNumber", 32);
  const password = requiredPassword(body.password);
  const confirmPassword = requiredPassword(body.confirmPassword);

  if (!emailPattern.test(email)) {
    throw new AuthError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }

  if (Buffer.byteLength(password, "utf8") > 72 || password.length < 8 ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AuthError(
      400,
      "INVALID_PASSWORD",
      "Password must be 8 to 72 UTF-8 bytes and include an uppercase letter, a lowercase letter, and a number.",
    );
  }

  if (password !== confirmPassword) {
    throw new AuthError(400, "PASSWORD_MISMATCH", "Passwords do not match.");
  }

  return { firstName, lastName, email, phoneNumber, password };
}

function validateLogin(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AuthError(400, "VALIDATION_ERROR", "A JSON object is required.");
  }

  const email = requiredString(body.email, "email", 254).toLowerCase();
  const password = requiredPassword(body.password);

  if (!emailPattern.test(email)) {
    throw new AuthError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }

  return { email, password };
}

function createToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }

  return jwt.sign(
    { userId: user.id, role: user.role },
    secret,
    { expiresIn: "1h", issuer: "aido-care", audience: "aido-care-api" },
  );
}

function safeUser(user) {
  return { id: user.id, email: user.email, role: user.role };
}

async function registerPatient(body) {
  const input = validateRegistration(body);
  const prisma = await getPrismaClient();

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new AuthError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, passwordHashCost);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: "PATIENT",
      patient: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phoneNumber,
        },
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  return user;
}

async function login(body) {
  const input = validateLogin(body);
  const prisma = await getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, role: true, passwordHash: true },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AuthError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  return { token: createToken(user), user: safeUser(user) };
}

module.exports = { AuthError, login, registerPatient };
