const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const jwt = require("jsonwebtoken");

const testSecret = "middleware-test-secret-with-32-characters";
process.env.JWT_SECRET = testSecret;
process.env.NODE_ENV = "test";

const app = require("../src/app");
const doctorService = require("../src/doctorService");
const patientService = require("../src/patientService");

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

function token(claims, options = {}) {
  return jwt.sign(claims, testSecret, {
    issuer: "aido-care",
    audience: "aido-care-api",
    ...options,
  });
}

async function request(method, path, accessToken, body) {
  const headers = {};
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (body) headers["content-type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json() };
}

test("GET /api/doctor/account rejects unauthenticated requests", async () => {
  const { response, body } = await request("GET", "/api/doctor/account");
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("GET /api/doctor/account rejects patient role", async () => {
  const patientToken = token({ userId: "patient-1", role: "PATIENT" });
  const { response, body } = await request("GET", "/api/doctor/account", patientToken);
  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
});

test("GET /api/doctor/account returns doctor account data for doctor role", async () => {
  const originalGetDoctorAccount = doctorService.getDoctorAccount;
  doctorService.getDoctorAccount = async (userId) => ({
    id: "doc-1",
    userId,
    email: "doctor@example.test",
    firstName: "Sarah",
    lastName: "Wilson",
    licenseNumber: "LIC-12345",
    bio: "Cardiology specialist",
    specialty: "Cardiology",
    specialties: ["Cardiology"],
  });

  try {
    const doctorToken = token({ userId: "doctor-1", role: "DOCTOR" });
    const { response, body } = await request("GET", "/api/doctor/account", doctorToken);
    assert.equal(response.status, 200);
    assert.equal(body.doctor.firstName, "Sarah");
    assert.equal(body.doctor.specialty, "Cardiology");
  } finally {
    doctorService.getDoctorAccount = originalGetDoctorAccount;
  }
});

test("PUT /api/doctor/account updates doctor account for doctor role", async () => {
  const originalUpdate = doctorService.updateDoctorAccount;
  doctorService.updateDoctorAccount = async (userId, data) => ({
    id: "doc-1",
    userId,
    email: "doctor@example.test",
    firstName: data.firstName || "Sarah",
    lastName: data.lastName || "Wilson",
    licenseNumber: "LIC-12345",
    bio: data.bio || "Updated bio",
    specialty: data.specialty || "Dermatology",
    specialties: [data.specialty || "Dermatology"],
  });

  try {
    const doctorToken = token({ userId: "doctor-1", role: "DOCTOR" });
    const { response, body } = await request("PUT", "/api/doctor/account", doctorToken, {
      firstName: "Sarah",
      lastName: "Johnson",
      specialty: "Dermatology",
    });
    assert.equal(response.status, 200);
    assert.equal(body.message, "Doctor account updated successfully");
    assert.equal(body.doctor.lastName, "Johnson");
    assert.equal(body.doctor.specialty, "Dermatology");
  } finally {
    doctorService.updateDoctorAccount = originalUpdate;
  }
});

test("GET /api/patient/profile rejects unauthenticated requests", async () => {
  const { response, body } = await request("GET", "/api/patient/profile");
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("GET /api/patient/profile rejects doctor role", async () => {
  const doctorToken = token({ userId: "doc-1", role: "DOCTOR" });
  const { response, body } = await request("GET", "/api/patient/profile", doctorToken);
  assert.equal(response.status, 403);
  assert.equal(body.error.code, "FORBIDDEN");
});

test("GET /api/patient/profile returns patient profile for patient role", async () => {
  const originalGetProfile = patientService.getPatientProfile;
  patientService.getPatientProfile = async (userId) => ({
    id: "pat-1",
    userId,
    email: "patient@example.test",
    firstName: "John",
    lastName: "Doe",
    phone: "08123456789",
    dateOfBirth: "1995-05-15",
    gender: "male",
    allergies: ["Peanuts"],
  });

  try {
    const patientToken = token({ userId: "patient-1", role: "PATIENT" });
    const { response, body } = await request("GET", "/api/patient/profile", patientToken);
    assert.equal(response.status, 200);
    assert.equal(body.profile.firstName, "John");
    assert.equal(body.profile.gender, "male");
  } finally {
    patientService.getPatientProfile = originalGetProfile;
  }
});

test("PUT /api/patient/profile updates patient profile for patient role", async () => {
  const originalUpdate = patientService.updatePatientProfile;
  patientService.updatePatientProfile = async (userId, data) => ({
    id: "pat-1",
    userId,
    email: "patient@example.test",
    firstName: data.firstName || "John",
    lastName: data.lastName || "Doe",
    phone: data.phone || "08123456789",
    dateOfBirth: data.dateOfBirth || "1995-05-15",
    gender: data.gender || "male",
    allergies: data.allergies || ["Pollen"],
  });

  try {
    const patientToken = token({ userId: "patient-1", role: "PATIENT" });
    const { response, body } = await request("PUT", "/api/patient/profile", patientToken, {
      firstName: "Johnny",
      allergies: ["Pollen", "Penicillin"],
    });
    assert.equal(response.status, 200);
    assert.equal(body.message, "Patient profile updated successfully");
    assert.equal(body.profile.firstName, "Johnny");
  } finally {
    patientService.updatePatientProfile = originalUpdate;
  }
});
