const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const jwt = require("jsonwebtoken");

const testSecret = "middleware-test-secret-with-32-characters";
process.env.JWT_SECRET = testSecret;
process.env.NODE_ENV = "test";

const app = require("../src/app");
const appointmentService = require("../src/appointmentService");
const medicalRecordService = require("../src/medicalRecordService");
const doctorDirectoryService = require("../src/doctorDirectoryService");

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

// ── Feature C Tests: Doctor Directory ─────────────────────────

test("GET /api/doctors returns list of doctors without exposing private credentials", async () => {
  const originalList = doctorDirectoryService.listDoctors;
  doctorDirectoryService.listDoctors = async () => [
    {
      id: "doc-1",
      firstName: "Sarah",
      lastName: "Anderson",
      specialty: "General Medicine",
      specialties: ["General Medicine"],
      title: "General Practitioner",
      experience: 8,
      rating: 4.9,
      reviewCount: 124,
      bio: "Experienced doctor.",
      consultationFee: 150000,
      location: "Aido Care Clinic",
      availability: { 1: ["09:00", "09:30"] },
    },
  ];

  try {
    const { response, body } = await request("GET", "/api/doctors");
    assert.equal(response.status, 200);
    assert.equal(Array.isArray(body.doctors), true);
    assert.equal(body.doctors.length, 1);
    assert.equal(body.doctors[0].firstName, "Sarah");
    // Ensure no password hashes or tokens
    assert.equal(body.doctors[0].passwordHash, undefined);
    assert.equal(body.doctors[0].token, undefined);
  } finally {
    doctorDirectoryService.listDoctors = originalList;
  }
});

test("GET /api/doctors/:id returns doctor public profile", async () => {
  const originalGet = doctorDirectoryService.getDoctorById;
  doctorDirectoryService.getDoctorById = async (id) => {
    if (id === "doc-1") {
      return {
        id: "doc-1",
        firstName: "Sarah",
        lastName: "Anderson",
        specialty: "General Medicine",
        specialties: ["General Medicine"],
        availability: { 1: ["09:00"] },
      };
    }
    throw new doctorDirectoryService.DoctorDirectoryError(404, "DOCTOR_NOT_FOUND", "Doctor not found.");
  };

  try {
    const { response, body } = await request("GET", "/api/doctors/doc-1");
    assert.equal(response.status, 200);
    assert.equal(body.doctor.id, "doc-1");

    const notFound = await request("GET", "/api/doctors/invalid-id");
    assert.equal(notFound.response.status, 404);
  } finally {
    doctorDirectoryService.getDoctorById = originalGet;
  }
});

test("GET /api/doctor/schedules requires DOCTOR role", async () => {
  const patientToken = token({ userId: "pat-1", role: "PATIENT" });
  const { response } = await request("GET", "/api/doctor/schedules", patientToken);
  assert.equal(response.status, 403);
});

// ── Feature A Tests: Appointments ─────────────────────────────

test("POST /api/appointments rejects unauthenticated users", async () => {
  const { response, body } = await request("POST", "/api/appointments", null, {
    doctorId: "doc-1",
    appointmentDate: "2026-12-01",
    startTime: "09:00",
  });
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("POST /api/appointments allows authenticated patient to book with valid data", async () => {
  const originalBook = appointmentService.bookAppointment;
  appointmentService.bookAppointment = async (userId, role, payload) => ({
    id: "apt-1",
    patientId: "patient-1",
    doctorId: payload.doctorId,
    date: payload.appointmentDate,
    time: payload.startTime,
    status: "confirmed",
    queueNumber: 1,
  });

  try {
    const patientToken = token({ userId: "patient-1", role: "PATIENT" });
    const { response, body } = await request("POST", "/api/appointments", patientToken, {
      doctorId: "doc-1",
      appointmentDate: "2026-11-20",
      startTime: "10:00",
    });
    assert.equal(response.status, 201);
    assert.equal(body.message, "Appointment booked successfully");
    assert.equal(body.appointment.id, "apt-1");
    assert.equal(body.appointment.status, "confirmed");
  } finally {
    appointmentService.bookAppointment = originalBook;
  }
});

test("POST /api/appointments rejects past booking dates", async () => {
  const originalBook = appointmentService.bookAppointment;
  appointmentService.bookAppointment = async () => {
    throw new appointmentService.AppointmentError(400, "PAST_APPOINTMENT_NOT_ALLOWED", "Cannot book an appointment in the past.");
  };

  try {
    const patientToken = token({ userId: "patient-1", role: "PATIENT" });
    const { response, body } = await request("POST", "/api/appointments", patientToken, {
      doctorId: "doc-1",
      appointmentDate: "2020-01-01",
      startTime: "09:00",
    });
    assert.equal(response.status, 400);
    assert.equal(body.error.code, "PAST_APPOINTMENT_NOT_ALLOWED");
  } finally {
    appointmentService.bookAppointment = originalBook;
  }
});

test("POST /api/appointments rejects conflicting bookings", async () => {
  const originalBook = appointmentService.bookAppointment;
  appointmentService.bookAppointment = async () => {
    throw new appointmentService.AppointmentError(409, "SLOT_CONFLICT", "This time slot is already booked for this doctor. Please choose another time.");
  };

  try {
    const patientToken = token({ userId: "patient-1", role: "PATIENT" });
    const { response, body } = await request("POST", "/api/appointments", patientToken, {
      doctorId: "doc-1",
      appointmentDate: "2026-11-20",
      startTime: "10:00",
    });
    assert.equal(response.status, 409);
    assert.equal(body.error.code, "SLOT_CONFLICT");
  } finally {
    appointmentService.bookAppointment = originalBook;
  }
});

test("GET /api/appointments/:id prevents patient from accessing another patient's appointment", async () => {
  const originalGet = appointmentService.getAppointmentById;
  appointmentService.getAppointmentById = async (userId) => {
    if (userId !== "owner-patient") {
      throw new appointmentService.AppointmentError(403, "FORBIDDEN", "You do not have permission to view this appointment.");
    }
    return { id: "apt-1", status: "confirmed" };
  };

  try {
    const otherPatientToken = token({ userId: "other-patient", role: "PATIENT" });
    const { response, body } = await request("GET", "/api/appointments/apt-1", otherPatientToken);
    assert.equal(response.status, 403);
    assert.equal(body.error.code, "FORBIDDEN");
  } finally {
    appointmentService.getAppointmentById = originalGet;
  }
});

test("PATCH /api/appointments/:id allows cancellation and rescheduling with validation", async () => {
  const originalUpdate = appointmentService.updateAppointment;
  appointmentService.updateAppointment = async (userId, role, aptId, payload) => {
    if (payload.status === "CANCELLED") {
      return { id: aptId, status: "cancelled" };
    }
    if (payload.appointmentDate && payload.startTime) {
      return { id: aptId, date: payload.appointmentDate, time: payload.startTime, status: "confirmed" };
    }
    return { id: aptId, status: "confirmed" };
  };

  try {
    const patientToken = token({ userId: "owner-patient", role: "PATIENT" });
    // Test cancel
    const cancelRes = await request("PATCH", "/api/appointments/apt-1", patientToken, { status: "CANCELLED" });
    assert.equal(cancelRes.response.status, 200);
    assert.equal(cancelRes.body.appointment.status, "cancelled");

    // Test reschedule
    const reschedRes = await request("PATCH", "/api/appointments/apt-1", patientToken, {
      appointmentDate: "2026-11-22",
      startTime: "14:00",
    });
    assert.equal(reschedRes.response.status, 200);
    assert.equal(reschedRes.body.appointment.date, "2026-11-22");
    assert.equal(reschedRes.body.appointment.time, "14:00");
  } finally {
    appointmentService.updateAppointment = originalUpdate;
  }
});

// ── Feature B Tests: Medical Records ──────────────────────────

test("POST /api/patients/:id/records rejects unauthorized users (e.g. PATIENT role)", async () => {
  const patientToken = token({ userId: "patient-1", role: "PATIENT" });
  const { response, body } = await request("POST", "/api/patients/pat-1/records", patientToken, {
    title: "General Checkup",
    content: "Patient reported headache.",
  });
  // MedicalRecord creation requires DOCTOR role
  assert.equal(response.status, 403);
});

test("POST /api/patients/:id/records allows DOCTOR to create medical record and persist prescriptions", async () => {
  const originalCreate = medicalRecordService.createMedicalRecord;
  medicalRecordService.createMedicalRecord = async (userId, role, patientId, payload) => ({
    id: "rec-1",
    patientId,
    doctorId: "doc-1",
    title: payload.title,
    content: payload.content,
    symptoms: payload.symptoms || "",
    diagnosis: payload.diagnosis || "",
    prescriptions: payload.prescriptions || [],
    status: "ACTIVE",
  });

  try {
    const doctorToken = token({ userId: "doc-user-1", role: "DOCTOR" });
    const { response, body } = await request("POST", "/api/patients/pat-1/records", doctorToken, {
      title: "Cardiology Follow-up",
      content: "Blood pressure normal.",
      diagnosis: "Mild hypertension",
      prescriptions: [
        {
          medication: "Amlodipine 5mg",
          dosage: "1 tablet",
          frequency: "Once daily",
          duration: "30 days",
        },
      ],
    });
    assert.equal(response.status, 201);
    assert.equal(body.record.title, "Cardiology Follow-up");
    assert.equal(body.record.prescriptions.length, 1);
    assert.equal(body.record.prescriptions[0].medication, "Amlodipine 5mg");
  } finally {
    medicalRecordService.createMedicalRecord = originalCreate;
  }
});

test("GET /api/patients/:id/records prevents patient from accessing another patient's records", async () => {
  const originalList = medicalRecordService.listPatientRecords;
  medicalRecordService.listPatientRecords = async (userId, role, patientId) => {
    if (role === "PATIENT" && patientId !== "my-patient-id") {
      throw new medicalRecordService.MedicalRecordError(403, "FORBIDDEN", "You do not have permission to view this patient's medical records.");
    }
    return [];
  };

  try {
    const patientToken = token({ userId: "patient-1", role: "PATIENT" });
    const { response, body } = await request("GET", "/api/patients/other-patient-id/records", patientToken);
    assert.equal(response.status, 403);
    assert.equal(body.error.code, "FORBIDDEN");
  } finally {
    medicalRecordService.listPatientRecords = originalList;
  }
});

test("GET /api/patients/:id/records allows authorized user to view records", async () => {
  const originalList = medicalRecordService.listPatientRecords;
  medicalRecordService.listPatientRecords = async (userId, role, patientId) => [
    {
      id: "rec-1",
      patientId,
      title: "Annual Checkup",
      content: "All clear.",
      status: "ACTIVE",
      prescriptions: [],
    },
  ];

  try {
    const doctorToken = token({ userId: "doctor-1", role: "DOCTOR" });
    const { response, body } = await request("GET", "/api/patients/pat-1/records", doctorToken);
    assert.equal(response.status, 200);
    assert.equal(Array.isArray(body.records), true);
    assert.equal(body.records.length, 1);
    assert.equal(body.records[0].title, "Annual Checkup");
  } finally {
    medicalRecordService.listPatientRecords = originalList;
  }
});
