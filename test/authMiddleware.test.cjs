const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const jwt = require("jsonwebtoken");

const previousSecret = process.env.JWT_SECRET;
const previousNodeEnv = process.env.NODE_ENV;
const testSecret = previousSecret || "middleware-test-secret-with-32-characters";
process.env.JWT_SECRET = testSecret;
process.env.NODE_ENV = "test";

const app = require("../src/app");

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
  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

function token(claims, options = {}) {
  return jwt.sign(claims, testSecret, {
    issuer: "aido-care",
    audience: "aido-care-api",
    ...options,
  });
}

async function get(path, accessToken) {
  const headers = accessToken ? { authorization: `Bearer ${accessToken}` } : {};
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return { response, body: await response.json() };
}

test("/api/auth/me returns safe identity for a valid token", async () => {
  const accessToken = token({ userId: "user-123", role: "PATIENT" });
  const { response, body } = await get("/api/auth/me", accessToken);
  assert.equal(response.status, 200);
  assert.deepEqual(body, { user: { id: "user-123", role: "PATIENT" } });
});

test("/api/auth/me rejects a missing token", async () => {
  const { response, body } = await get("/api/auth/me");
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("/api/auth/me rejects malformed and invalid tokens", async () => {
  const malformed = await get("/api/auth/me", "not-a-jwt");
  assert.equal(malformed.response.status, 401);
  assert.equal(malformed.body.error.code, "INVALID_TOKEN");

  const invalid = await get("/api/auth/me", "invalid.token.value");
  assert.equal(invalid.response.status, 401);
  assert.equal(invalid.body.error.code, "INVALID_TOKEN");
});

test("/api/auth/me rejects expired tokens", async () => {
  const accessToken = token({ userId: "user-123", role: "PATIENT" }, { expiresIn: -1 });
  const { response, body } = await get("/api/auth/me", accessToken);
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "INVALID_TOKEN");
});

test("patient role endpoint allows patients and rejects doctors", async () => {
  const accessToken = token({ userId: "user-123", role: "PATIENT" });
  const allowed = await get("/api/auth/test/patient", accessToken);
  assert.equal(allowed.response.status, 200);
  assert.deepEqual(allowed.body, {
    message: "Patient authorization successful",
    user: { id: "user-123", role: "PATIENT" },
  });

  const doctorToken = token({ userId: "doctor-123", role: "DOCTOR" });
  const rejected = await get("/api/auth/test/patient", doctorToken);
  assert.equal(rejected.response.status, 403);
  assert.equal(rejected.body.error.code, "FORBIDDEN");
});

test("doctor role endpoint allows doctors and rejects patients", async () => {
  const doctorToken = token({ userId: "doctor-123", role: "DOCTOR" });
  const allowed = await get("/api/auth/test/doctor", doctorToken);
  assert.equal(allowed.response.status, 200);
  assert.deepEqual(allowed.body, {
    message: "Doctor authorization successful",
    user: { id: "doctor-123", role: "DOCTOR" },
  });

  const patientToken = token({ userId: "user-123", role: "PATIENT" });
  const rejected = await get("/api/auth/test/doctor", patientToken);
  assert.equal(rejected.response.status, 403);
  assert.equal(rejected.body.error.code, "FORBIDDEN");
});