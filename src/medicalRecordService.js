const { PrismaPg } = require("@prisma/adapter-pg");

let prismaClientPromise;

class MedicalRecordError extends Error {
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

function parseRecordContent(rawContent) {
  if (!rawContent) {
    return {
      summary: "",
      symptoms: "",
      diagnosis: "",
      treatment: "",
      notes: "",
      status: "ACTIVE",
      prescriptions: [],
    };
  }

  try {
    const parsed = JSON.parse(rawContent);
    if (typeof parsed === "object" && parsed !== null) {
      return {
        summary: parsed.summary || parsed.content || "",
        symptoms: parsed.symptoms || "",
        diagnosis: parsed.diagnosis || "",
        treatment: parsed.treatment || "",
        notes: parsed.notes || "",
        status: parsed.status || "ACTIVE",
        prescriptions: Array.isArray(parsed.prescriptions) ? parsed.prescriptions : [],
      };
    }
  } catch {
    // Plain text content
  }

  return {
    summary: rawContent,
    symptoms: "",
    diagnosis: "",
    treatment: "",
    notes: "",
    status: "ACTIVE",
    prescriptions: [],
  };
}

function formatRecordPayload(record) {
  const parsed = parseRecordContent(record.content);
  const docFirst = record.doctor?.user?.patient?.firstName || "Doctor";
  const docLast = record.doctor?.user?.patient?.lastName || (record.doctor?.licenseNumber ? `(${record.doctor.licenseNumber})` : "");
  const spec = record.doctor?.specialties?.[0]?.name || "General Practice";

  return {
    id: record.id,
    patientId: record.patientId,
    doctorId: record.doctorId,
    title: record.title,
    content: parsed.summary,
    summary: parsed.summary,
    symptoms: parsed.symptoms,
    diagnosis: parsed.diagnosis,
    treatment: parsed.treatment,
    notes: parsed.notes,
    status: parsed.status,
    prescriptions: parsed.prescriptions.map((p) => ({
      ...p,
      medicalRecordId: record.id,
      patientId: record.patientId,
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    doctor: {
      id: record.doctorId,
      firstName: docFirst,
      lastName: docLast,
      name: `Dr. ${docFirst} ${docLast}`.trim(),
      specialty: spec,
    },
    patient: {
      id: record.patientId,
      firstName: record.patient?.firstName || "Patient",
      lastName: record.patient?.lastName || "",
    },
  };
}

async function listPatientRecords(userId, role, patientId, { includeArchived = false } = {}) {
  const prisma = await getPrismaClient();

  // If patient, verify ownership
  if (role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient || patient.id !== patientId) {
      throw new MedicalRecordError(403, "FORBIDDEN", "You do not have permission to view this patient's medical records.");
    }
  }

  // If doctor, verify doctor profile exists
  if (role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      throw new MedicalRecordError(403, "FORBIDDEN", "Doctor account profile was not found.");
    }
  }

  const records = await prisma.medicalRecord.findMany({
    where: { patientId },
    include: {
      doctor: {
        include: {
          user: { include: { patient: true } },
          specialties: true,
        },
      },
      patient: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let formatted = records.map(formatRecordPayload);

  if (!includeArchived) {
    formatted = formatted.filter((r) => r.status !== "ARCHIVED");
  }

  return formatted;
}

async function getMedicalRecordById(userId, role, patientId, recordId) {
  const prisma = await getPrismaClient();

  if (role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient || patient.id !== patientId) {
      throw new MedicalRecordError(403, "FORBIDDEN", "You do not have permission to view this medical record.");
    }
  }

  const record = await prisma.medicalRecord.findFirst({
    where: {
      id: recordId,
      patientId,
    },
    include: {
      doctor: {
        include: {
          user: { include: { patient: true } },
          specialties: true,
        },
      },
      patient: true,
    },
  });

  if (!record) {
    throw new MedicalRecordError(404, "RECORD_NOT_FOUND", "Medical record was not found.");
  }

  return formatRecordPayload(record);
}

async function createMedicalRecord(userId, role, patientId, payload = {}) {
  const prisma = await getPrismaClient();

  if (role !== "DOCTOR") {
    throw new MedicalRecordError(403, "FORBIDDEN", "Only authorized doctors can create medical records.");
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    throw new MedicalRecordError(403, "FORBIDDEN", "Doctor account profile was not found.");
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    throw new MedicalRecordError(404, "PATIENT_NOT_FOUND", "Patient was not found.");
  }

  const { title, content, summary, symptoms, diagnosis, treatment, notes, prescriptions } = payload;

  if (!title || !title.trim()) {
    throw new MedicalRecordError(400, "MISSING_TITLE", "Medical record title is required.");
  }

  const finalSummary = (content || summary || "").trim();
  if (!finalSummary) {
    throw new MedicalRecordError(400, "MISSING_CONTENT", "Consultation summary or content is required.");
  }

  const structuredContent = JSON.stringify({
    summary: finalSummary,
    symptoms: (symptoms || "").trim(),
    diagnosis: (diagnosis || "").trim(),
    treatment: (treatment || "").trim(),
    notes: (notes || "").trim(),
    status: "ACTIVE",
    prescriptions: Array.isArray(prescriptions) ? prescriptions : [],
  });

  const record = await prisma.medicalRecord.create({
    data: {
      patientId,
      doctorId: doctor.id,
      title: title.trim(),
      content: structuredContent,
    },
    include: {
      doctor: {
        include: {
          user: { include: { patient: true } },
          specialties: true,
        },
      },
      patient: true,
    },
  });

  return formatRecordPayload(record);
}

async function updateMedicalRecord(userId, role, patientId, recordId, payload = {}) {
  const prisma = await getPrismaClient();

  if (role !== "DOCTOR") {
    throw new MedicalRecordError(403, "FORBIDDEN", "Only authorized doctors can update medical records.");
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    throw new MedicalRecordError(403, "FORBIDDEN", "Doctor account profile was not found.");
  }

  const existing = await prisma.medicalRecord.findFirst({
    where: { id: recordId, patientId },
  });

  if (!existing) {
    throw new MedicalRecordError(404, "RECORD_NOT_FOUND", "Medical record was not found.");
  }

  const existingParsed = parseRecordContent(existing.content);

  const updatedContent = JSON.stringify({
    summary: payload.content !== undefined ? payload.content : (payload.summary !== undefined ? payload.summary : existingParsed.summary),
    symptoms: payload.symptoms !== undefined ? payload.symptoms : existingParsed.symptoms,
    diagnosis: payload.diagnosis !== undefined ? payload.diagnosis : existingParsed.diagnosis,
    treatment: payload.treatment !== undefined ? payload.treatment : existingParsed.treatment,
    notes: payload.notes !== undefined ? payload.notes : existingParsed.notes,
    status: payload.status !== undefined ? payload.status : existingParsed.status,
    prescriptions: payload.prescriptions !== undefined ? payload.prescriptions : existingParsed.prescriptions,
  });

  const updated = await prisma.medicalRecord.update({
    where: { id: recordId },
    data: {
      title: payload.title !== undefined ? payload.title.trim() : existing.title,
      content: updatedContent,
    },
    include: {
      doctor: {
        include: {
          user: { include: { patient: true } },
          specialties: true,
        },
      },
      patient: true,
    },
  });

  return formatRecordPayload(updated);
}

async function listPatients(userId, role) {
  const prisma = await getPrismaClient();

  if (role !== "DOCTOR") {
    throw new MedicalRecordError(403, "FORBIDDEN", "Only healthcare providers can view patient lists.");
  }

  const patients = await prisma.patient.findMany({
    include: {
      user: { select: { email: true } },
      appointments: {
        orderBy: { appointmentDate: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return patients.map((p) => {
    let dobString = "";
    if (p.dateOfBirth) {
      dobString = p.dateOfBirth instanceof Date ? p.dateOfBirth.toISOString().split("T")[0] : String(p.dateOfBirth).split("T")[0];
    }
    const lastVisitDate = p.appointments?.[0]?.appointmentDate;
    let lastVisitString = "";
    if (lastVisitDate) {
      lastVisitString = lastVisitDate instanceof Date ? lastVisitDate.toISOString().split("T")[0] : String(lastVisitDate).split("T")[0];
    }

    return {
      id: p.id,
      userId: p.userId,
      firstName: p.firstName || "Patient",
      lastName: p.lastName || "",
      phone: p.phone || "",
      dateOfBirth: dobString,
      gender: p.gender || "",
      allergies: p.allergies || [],
      user: { email: p.user?.email || "" },
      lastVisit: lastVisitString || p.updatedAt?.toISOString() || null,
    };
  });
}

async function getPatientDetails(userId, role, patientId) {
  const prisma = await getPrismaClient();

  if (role === "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient || patient.id !== patientId) {
      throw new MedicalRecordError(403, "FORBIDDEN", "You do not have permission to view this patient profile.");
    }
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: { select: { email: true } },
      appointments: {
        include: {
          doctor: {
            include: {
              user: { include: { patient: true } },
              specialties: true,
            },
          },
        },
        orderBy: { appointmentDate: "desc" },
        take: 10,
      },
    },
  });

  if (!patient) {
    throw new MedicalRecordError(404, "PATIENT_NOT_FOUND", "Patient was not found.");
  }

  let dobString = "";
  if (patient.dateOfBirth) {
    dobString = patient.dateOfBirth instanceof Date ? patient.dateOfBirth.toISOString().split("T")[0] : String(patient.dateOfBirth).split("T")[0];
  }

  return {
    id: patient.id,
    userId: patient.userId,
    firstName: patient.firstName || "Patient",
    lastName: patient.lastName || "",
    phone: patient.phone || "",
    dateOfBirth: dobString,
    gender: patient.gender || "",
    allergies: patient.allergies || [],
    user: { email: patient.user?.email || "" },
    appointments: (patient.appointments || []).map((apt) => ({
      id: apt.id,
      appointmentDate: apt.appointmentDate instanceof Date ? apt.appointmentDate.toISOString() : apt.appointmentDate,
      startTime: apt.startTime instanceof Date ? apt.startTime.toISOString() : apt.startTime,
      status: apt.status,
      queueNumber: apt.queueNumber,
      doctor: {
        id: apt.doctorId,
        firstName: apt.doctor?.user?.patient?.firstName || "Doctor",
        lastName: apt.doctor?.user?.patient?.lastName || "",
        specialty: apt.doctor?.specialties?.[0]?.name || "General Practice",
      },
    })),
  };
}

module.exports = {
  MedicalRecordError,
  listPatientRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  listPatients,
  getPatientDetails,
  formatRecordPayload,
};
