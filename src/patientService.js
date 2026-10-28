const { PrismaPg } = require("@prisma/adapter-pg");

let prismaClientPromise;

class PatientError extends Error {
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

function formatPatientPayload(patient) {
  let dobString = "";
  if (patient.dateOfBirth) {
    if (patient.dateOfBirth instanceof Date && !isNaN(patient.dateOfBirth.getTime())) {
      dobString = patient.dateOfBirth.toISOString().split("T")[0];
    } else if (typeof patient.dateOfBirth === "string") {
      dobString = patient.dateOfBirth.split("T")[0];
    }
  }

  return {
    id: patient.id,
    userId: patient.userId,
    email: patient.user?.email || null,
    firstName: patient.firstName || "",
    lastName: patient.lastName || "",
    phone: patient.phone || "",
    dateOfBirth: dobString,
    gender: patient.gender || "",
    allergies: Array.isArray(patient.allergies) ? patient.allergies : [],
  };
}

async function getPatientProfile(userId) {
  const prisma = await getPrismaClient();
  const patient = await prisma.patient.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!patient) {
    throw new PatientError(404, "PATIENT_NOT_FOUND", "Patient profile was not found.");
  }

  return formatPatientPayload(patient);
}

async function updatePatientProfile(userId, data = {}) {
  const prisma = await getPrismaClient();

  const updateData = {};

  if (data.firstName !== undefined) {
    updateData.firstName = typeof data.firstName === "string" ? data.firstName.trim() : null;
  }
  if (data.lastName !== undefined) {
    updateData.lastName = typeof data.lastName === "string" ? data.lastName.trim() : null;
  }
  if (data.phone !== undefined) {
    updateData.phone = typeof data.phone === "string" ? data.phone.trim() : null;
  }
  if (data.gender !== undefined) {
    updateData.gender = typeof data.gender === "string" ? data.gender.trim() : null;
  }

  if (data.allergies !== undefined) {
    if (Array.isArray(data.allergies)) {
      updateData.allergies = data.allergies.map((a) => String(a).trim()).filter(Boolean);
    } else if (typeof data.allergies === "string") {
      updateData.allergies = data.allergies
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
    } else {
      updateData.allergies = [];
    }
  }

  if (data.dateOfBirth !== undefined) {
    if (data.dateOfBirth && typeof data.dateOfBirth === "string") {
      const parsed = new Date(data.dateOfBirth);
      updateData.dateOfBirth = !isNaN(parsed.getTime()) ? parsed : null;
    } else if (data.dateOfBirth instanceof Date && !isNaN(data.dateOfBirth.getTime())) {
      updateData.dateOfBirth = data.dateOfBirth;
    } else {
      updateData.dateOfBirth = null;
    }
  }

  const patient = await prisma.patient.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      ...updateData,
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  return formatPatientPayload(patient);
}

module.exports = {
  PatientError,
  getPatientProfile,
  updatePatientProfile,
};
