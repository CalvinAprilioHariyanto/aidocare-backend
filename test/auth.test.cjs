const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("../src/app");
const authService = require("../src/authService");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

test("registration rejects missing required fields", async () => {
  const { response, body } = await post("/api/auth/register", {
    firstName: "Test",
    lastName: "Patient",
    email: "patient@example.test",
    phoneNumber: "5550100",
    password: "SecurePass123",
  });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("registration returns only the public user fields on success", async () => {
  const originalRegisterPatient = authService.registerPatient;
  authService.registerPatient = async () => ({
    id: "user-123",
    email: "patient@example.test",
    role: "PATIENT",
    passwordHash: "private-hash",
    patient: { firstName: "Test" },
  });

  try {
    const { response, body } = await post("/api/auth/register", {
      firstName: "Sarah",
      lastName: "Wijaya",
      email: "sarah.wijaya@test.com",
      phoneNumber: "081298765432",
      password: "SarahTest123!",
      confirmPassword: "SarahTest123!",
    });
    assert.equal(response.status, 201);
    assert.deepEqual(body, {
      message: "Registration successful",
      user: {
        id: "user-123",
        email: "patient@example.test",
        role: "PATIENT",
      },
    });
  } finally {
    authService.registerPatient = originalRegisterPatient;
  }
});

test("registration rejects malformed email addresses", async () => {
  const { response, body } = await post("/api/auth/register", {
    firstName: "Test",
    lastName: "Patient",
    email: "not-an-email",
    phoneNumber: "5550100",
    password: "SecurePass123",
    confirmPassword: "SecurePass123",
  });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_EMAIL");
});

test("registration rejects mismatched password confirmation", async () => {
  const { response, body } = await post("/api/auth/register", {
    firstName: "Test",
    lastName: "Patient",
    email: "patient@example.test",
    phoneNumber: "5550100",
    password: "SecurePass123",
    confirmPassword: "DifferentPass123",
  });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "PASSWORD_MISMATCH");
});

test("registration rejects weak passwords", async () => {
  const { response, body } = await post("/api/auth/register", {
    firstName: "Test",
    lastName: "Patient",
    email: "patient@example.test",
    phoneNumber: "5550100",
    password: "password",
    confirmPassword: "password",
  });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_PASSWORD");
});

test("login rejects missing credentials", async () => {
  const { response, body } = await post("/api/auth/login", { email: "patient@example.test" });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "VALIDATION_ERROR");
});

test("login rejects malformed email addresses", async () => {
  const { response, body } = await post("/api/auth/login", {
    email: "not-an-email",
    password: "SecurePass123",
  });
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_EMAIL");
});
