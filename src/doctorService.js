const { PrismaPg } = require("@prisma/adapter-pg");

let prismaClientPromise;

class DoctorError extends Error {
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

function formatDoctorPayload(doctor) {
  return {
    id: doctor.id,
    userId: doctor.userId,
    email: doctor.user.email,
    firstName: doctor.user.patient?.firstName || "",
    lastName: doctor.user.patient?.lastName || "",
    licenseNumber: doctor.licenseNumber,
    bio: doctor.bio || "",
    specialty: doctor.specialties?.[0]?.name || "",
    specialties: (doctor.specialties || []).map((s) => s.name),
  };
}

async function getDoctorAccount(userId) {
  const prisma = await getPrismaClient();
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    include: {
      user: {
        include: {
          patient: true,
        },
      },
      specialties: true,
    },
  });

  if (!doctor) {
    throw new DoctorError(404, "DOCTOR_NOT_FOUND", "Doctor account profile was not found.");
  }

  return formatDoctorPayload(doctor);
}

async function updateDoctorAccount(userId, data = {}) {
  const prisma = await getPrismaClient();

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    include: {
      user: {
        include: {
          patient: true,
        },
      },
      specialties: true,
    },
  });

  if (!doctor) {
    throw new DoctorError(404, "DOCTOR_NOT_FOUND", "Doctor account profile was not found.");
  }

  const { firstName, lastName, specialty, bio } = data;

  // Persist doctor name via the Patient relation on the User
  if (firstName !== undefined || lastName !== undefined) {
    const trimmedFirst = firstName !== undefined ? (typeof firstName === "string" ? firstName.trim() : "") : doctor.user.patient?.firstName;
    const trimmedLast = lastName !== undefined ? (typeof lastName === "string" ? lastName.trim() : "") : doctor.user.patient?.lastName;

    await prisma.patient.upsert({
      where: { userId },
      update: {
        firstName: trimmedFirst || null,
        lastName: trimmedLast || null,
      },
      create: {
        userId,
        firstName: trimmedFirst || null,
        lastName: trimmedLast || null,
      },
    });
  }

  const doctorUpdateData = {};
  if (bio !== undefined) {
    doctorUpdateData.bio = typeof bio === "string" ? bio.trim() : null;
  }

  if (specialty !== undefined && typeof specialty === "string" && specialty.trim()) {
    const specialtyName = specialty.trim();
    const specialtyRecord = await prisma.specialty.upsert({
      where: { name: specialtyName },
      update: {},
      create: { name: specialtyName },
    });
    doctorUpdateData.specialties = {
      set: [{ id: specialtyRecord.id }],
    };
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { userId },
    data: doctorUpdateData,
    include: {
      user: {
        include: {
          patient: true,
        },
      },
      specialties: true,
    },
  });

  return formatDoctorPayload(updatedDoctor);
}

module.exports = {
  DoctorError,
  getDoctorAccount,
  updateDoctorAccount,
};
