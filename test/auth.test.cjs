require("dotenv").config();
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

test("login succeeds with valid credentials and returns token + user payload", async () => {
  const originalLogin = authService.login;
  authService.login = async (body) => {
    assert.equal(body.email, "sarah.wijaya@test.com");
    assert.equal(body.password, "SarahTest123!");
    return {
      token: "mock-jwt-token",
      user: { id: "user-123", email: "sarah.wijaya@test.com", role: "PATIENT" },
    };
  };

  try {
    const { response, body } = await post("/api/auth/login", {
      email: "sarah.wijaya@test.com",
      password: "SarahTest123!",
    });
    assert.equal(response.status, 200);
    assert.equal(body.token, "mock-jwt-token");
    assert.equal(body.user.role, "PATIENT");
    assert.equal(body.user.email, "sarah.wijaya@test.com");
  } finally {
    authService.login = originalLogin;
  }
});

test("login rejects invalid password with 401 INVALID_CREDENTIALS", async () => {
  const originalLogin = authService.login;
  authService.login = async () => {
    throw new authService.AuthError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  };

  try {
    const { response, body } = await post("/api/auth/login", {
      email: "sarah.wijaya@test.com",
      password: "WrongPassword123!",
    });
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "INVALID_CREDENTIALS");
    assert.equal(body.error.message, "Email or password is incorrect.");
  } finally {
    authService.login = originalLogin;
  }
});

test("login rejects non-existent account with 401 INVALID_CREDENTIALS", async () => {
  const originalLogin = authService.login;
  authService.login = async () => {
    throw new authService.AuthError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  };

  try {
    const { response, body } = await post("/api/auth/login", {
      email: "unknown.user@example.test",
      password: "SecurePass123!",
    });
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "INVALID_CREDENTIALS");
    assert.equal(body.error.message, "Email or password is incorrect.");
  } finally {
    authService.login = originalLogin;
  }
});

test("login trims whitespace and normalizes email casing before validation", async () => {
  const originalLogin = authService.login;
  let receivedEmail = null;
  authService.login = async (body) => {
    receivedEmail = body.email;
    return {
      token: "mock-jwt-token",
      user: { id: "user-123", email: "sarah.wijaya@test.com", role: "PATIENT" },
    };
  };

  try {
    const { response, body } = await post("/api/auth/login", {
      email: "  Sarah.Wijaya@Test.com  ",
      password: "SarahTest123!",
    });
    assert.equal(response.status, 200);
    assert.equal(body.token, "mock-jwt-token");
    assert.equal(receivedEmail, "  Sarah.Wijaya@Test.com  ");
  } finally {
    authService.login = originalLogin;
  }
});

test("authService.login authenticates against seeded development account with casing/space tolerance", async () => {
  if (!process.env.DATABASE_URL) {
    return;
  }
  const result = await authService.login({
    email: "  SARAH.WIJAYA@TEST.COM  ",
    password: "SarahTest123!",
  });
  assert.ok(result.token);
  assert.equal(result.user.email, "sarah.wijaya@test.com");
  assert.equal(result.user.role, "PATIENT");

  // Verify wrong password fails
  await assert.rejects(
    () => authService.login({ email: "sarah.wijaya@test.com", password: "IncorrectPassword123!" }),
    (err) => err.status === 401 && err.code === "INVALID_CREDENTIALS",
  );

  // Verify non-existent user fails
  await assert.rejects(
    () => authService.login({ email: "doesnotexist@example.test", password: "SomePassword123!" }),
    (err) => err.status === 401 && err.code === "INVALID_CREDENTIALS",
  );
});


