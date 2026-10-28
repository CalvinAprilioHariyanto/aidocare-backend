const { PrismaPg } = require("@prisma/adapter-pg");

let prismaClientPromise;

class DoctorDirectoryError extends Error {
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

const DAY_MAP = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function formatTimeString(date) {
  if (!date) return "";
  if (typeof date === "string") {
    // If format like "09:00:00" or ISO
    if (date.includes("T")) {
      const d = new Date(date);
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
    return date.slice(0, 5);
  }
  if (date instanceof Date) {
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  }
  return "";
}

function generateTimeSlots(startStr, endStr) {
  const slots = [];
  const [startH, startM] = (startStr || "09:00").split(":").map(Number);
  const [endH, endM] = (endStr || "12:00").split(":").map(Number);

  let currentMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  while (currentMin < endMin) {
    const h = Math.floor(currentMin / 60);
    const m = currentMin % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    currentMin += 30; // 30 minute slot
  }

  return slots;
}

function formatPublicDoctor(doctor) {
  const firstName = doctor.user?.patient?.firstName || "Doctor";
  const lastName = doctor.user?.patient?.lastName || (doctor.licenseNumber ? `(${doctor.licenseNumber})` : "");
  const specialtyList = (doctor.specialties || []).map((s) => (typeof s === "string" ? s : s.name));
  const primarySpecialty = specialtyList[0] || "General Practice";

  // Build availability object: { [dayIndex]: ['09:00', ...] }
  const availability = {};
  const schedules = (doctor.schedules || []).filter((s) => s.isActive !== false);

  for (const s of schedules) {
    const dayIndex = DAY_MAP[s.dayOfWeek];
    if (dayIndex !== undefined) {
      const startStr = formatTimeString(s.startTime);
      const endStr = formatTimeString(s.endTime);
      const slots = generateTimeSlots(startStr, endStr);
      availability[dayIndex] = Array.from(new Set([...(availability[dayIndex] || []), ...slots])).sort();
    }
  }

  // If no schedules exist, provide default clinic weekday availability (Mon-Fri 09:00-15:00)
  if (Object.keys(availability).length === 0) {
    const defaultSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30'];
    [1, 2, 3, 4, 5].forEach((day) => {
      availability[day] = [...defaultSlots];
    });
  }

  return {
    id: doctor.id,
    firstName,
    lastName,
    name: `Dr. ${firstName} ${lastName}`.trim(),
    specialty: primarySpecialty,
    specialties: specialtyList,
    title: `${primarySpecialty} Specialist`,
    experience: 8,
    rating: 4.9,
    reviewCount: 95,
    bio: doctor.bio || "Dedicated healthcare professional providing comprehensive medical consultations.",
    education: "Faculty of Medicine",
    languages: ["English", "Indonesian"],
    consultationFee: 150000,
    location: "Aido Care Clinic",
    licenseNumber: doctor.licenseNumber,
    availability,
    schedules: schedules.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: formatTimeString(s.startTime),
      endTime: formatTimeString(s.endTime),
      isActive: s.isActive,
    })),
  };
}

async function listDoctors({ search = "", specialty = "" } = {}) {
  const prisma = await getPrismaClient();

  const where = {};
  if (specialty && specialty.trim()) {
    where.specialties = {
      some: {
        name: { equals: specialty.trim(), mode: "insensitive" },
      },
    };
  }

  const doctors = await prisma.doctor.findMany({
    where,
    include: {
      user: {
        include: {
          patient: true,
        },
      },
      specialties: true,
      schedules: {
        where: { isActive: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let formatted = doctors.map(formatPublicDoctor);

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    formatted = formatted.filter((doc) => {
      const fullName = `${doc.firstName} ${doc.lastName}`.toLowerCase();
      const spec = doc.specialty.toLowerCase();
      const allSpecs = doc.specialties.join(" ").toLowerCase();
      return fullName.includes(q) || spec.includes(q) || allSpecs.includes(q);
    });
  }

  return formatted;
}

async function getDoctorById(id) {
  const prisma = await getPrismaClient();

  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          patient: true,
        },
      },
      specialties: true,
      schedules: {
        where: { isActive: true },
      },
    },
  });

  if (!doctor) {
    throw new DoctorDirectoryError(404, "DOCTOR_NOT_FOUND", "Doctor was not found.");
  }

  return formatPublicDoctor(doctor);
}

async function getDoctorSchedules(userId) {
  const prisma = await getPrismaClient();

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    include: {
      schedules: true,
    },
  });

  if (!doctor) {
    throw new DoctorDirectoryError(404, "DOCTOR_NOT_FOUND", "Doctor account was not found.");
  }

  return (doctor.schedules || []).map((s) => ({
    id: s.id,
    doctorId: s.doctorId,
    dayOfWeek: s.dayOfWeek,
    startTime: formatTimeString(s.startTime),
    endTime: formatTimeString(s.endTime),
    isActive: s.isActive,
  }));
}

module.exports = {
  DoctorDirectoryError,
  listDoctors,
  getDoctorById,
  getDoctorSchedules,
  formatPublicDoctor,
};
