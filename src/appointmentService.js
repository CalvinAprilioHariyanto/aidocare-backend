const { PrismaPg } = require("@prisma/adapter-pg");

let prismaClientPromise;

class AppointmentError extends Error {
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

function parseAppointmentDate(dateInput) {
  if (!dateInput) return null;
  const str = typeof dateInput === "string" ? dateInput.split("T")[0] : new Date(dateInput).toISOString().split("T")[0];
  const parsed = new Date(`${str}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseStartTime(timeInput) {
  if (!timeInput) return null;
  let timeStr = timeInput;
  if (timeInput instanceof Date) {
    timeStr = `${String(timeInput.getUTCHours()).padStart(2, "0")}:${String(timeInput.getUTCMinutes()).padStart(2, "0")}`;
  } else if (typeof timeInput === "string" && timeInput.includes("T")) {
    const d = new Date(timeInput);
    timeStr = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  }
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return null;
  const hh = parts[0].padStart(2, "0");
  const mm = parts[1].slice(0, 2).padStart(2, "0");
  const parsed = new Date(`1970-01-01T${hh}:${mm}:00.000Z`);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatTimeString(date) {
  if (!date) return "";
  if (typeof date === "string") {
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

function formatDateString(date) {
  if (!date) return "";
  if (typeof date === "string") return date.split("T")[0];
  if (date instanceof Date) return date.toISOString().split("T")[0];
  return "";
}

function formatAppointmentPayload(apt) {
  const dateStr = formatDateString(apt.appointmentDate);
  const timeStr = formatTimeString(apt.startTime);
  const docFirst = apt.doctor?.user?.patient?.firstName || "Doctor";
  const docLast = apt.doctor?.user?.patient?.lastName || (apt.doctor?.licenseNumber ? `(${apt.doctor.licenseNumber})` : "");
  const spec = apt.doctor?.specialties?.[0]?.name || "General Practice";

  return {
    id: apt.id,
    patientId: apt.patientId,
    doctorId: apt.doctorId,
    date: dateStr,
    time: timeStr,
    appointmentDate: dateStr,
    startTime: timeStr,
    status: (apt.status || "CONFIRMED").toLowerCase(),
    rawStatus: apt.status,
    queueNumber: apt.queueNumber,
    queueStatus: apt.queueStatus,
    cancelledAt: apt.cancelledAt,
    createdAt: apt.createdAt,
    doctor: {
      id: apt.doctorId,
      firstName: docFirst,
      lastName: docLast,
      name: `Dr. ${docFirst} ${docLast}`.trim(),
      specialty: spec,
      bio: apt.doctor?.bio || "",
    },
    patient: {
      id: apt.patientId,
      firstName: apt.patient?.firstName || "Patient",
      lastName: apt.patient?.lastName || "",
      phone: apt.patient?.phone || "",
    },
  };
}

async function getOrCreatePatient(prisma, userId) {
  let patient = await prisma.patient.findUnique({
    where: { userId },
  });

  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        userId,
      },
    });
  }

  return patient;
}

async function bookAppointment(userId, role, payload = {}) {
  const prisma = await getPrismaClient();

  const { doctorId, appointmentDate, startTime, date, time } = payload;
  const targetDateInput = appointmentDate || date;
  const targetTimeInput = startTime || time;

  if (!doctorId) {
    throw new AppointmentError(400, "MISSING_DOCTOR_ID", "Doctor ID is required.");
  }
  if (!targetDateInput) {
    throw new AppointmentError(400, "MISSING_APPOINTMENT_DATE", "Appointment date is required.");
  }
  if (!targetTimeInput) {
    throw new AppointmentError(400, "MISSING_START_TIME", "Appointment start time is required.");
  }

  const parsedDate = parseAppointmentDate(targetDateInput);
  const parsedTime = parseStartTime(targetTimeInput);

  if (!parsedDate) {
    throw new AppointmentError(400, "INVALID_APPOINTMENT_DATE", "Invalid appointment date format.");
  }
  if (!parsedTime) {
    throw new AppointmentError(400, "INVALID_START_TIME", "Invalid appointment time format.");
  }

  // Prevent booking in the past
  const now = new Date();
  const dateStr = formatDateString(parsedDate);
  const timeStr = formatTimeString(parsedTime);
  const combinedDateTime = new Date(`${dateStr}T${timeStr}:00`);

  // Zero out today's start
  const todayZero = new Date();
  todayZero.setHours(0, 0, 0, 0);
  const appDateZero = new Date(parsedDate);
  appDateZero.setHours(0, 0, 0, 0);

  if (appDateZero < todayZero || combinedDateTime < now) {
    throw new AppointmentError(400, "PAST_APPOINTMENT_NOT_ALLOWED", "Cannot book an appointment in the past.");
  }

  // Verify doctor exists
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      user: {
        include: { patient: true },
      },
      specialties: true,
    },
  });

  if (!doctor) {
    throw new AppointmentError(404, "DOCTOR_NOT_FOUND", "Selected doctor was not found.");
  }

  // Resolve patient from userId (never trust patient ID from client)
  const patient = await getOrCreatePatient(prisma, userId);

  // Concurrency-safe slot conflict check
  const existingConflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      appointmentDate: parsedDate,
      startTime: parsedTime,
      status: {
        not: "CANCELLED",
      },
    },
  });

  if (existingConflict) {
    throw new AppointmentError(409, "SLOT_CONFLICT", "This time slot is already booked for this doctor. Please choose another time.");
  }

  // Calculate next queue number for this doctor on this day
  const queueCount = await prisma.appointment.count({
    where: {
      doctorId,
      appointmentDate: parsedDate,
      status: {
        not: "CANCELLED",
      },
    },
  });
  const queueNumber = queueCount + 1;

  // Create appointment in transaction
  const appointment = await prisma.$transaction(async (tx) => {
    // Double check conflict inside transaction
    const conflict = await tx.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: parsedDate,
        startTime: parsedTime,
        status: { not: "CANCELLED" },
      },
    });

    if (conflict) {
      throw new AppointmentError(409, "SLOT_CONFLICT", "This time slot is already booked for this doctor. Please choose another time.");
    }

    const created = await tx.appointment.create({
      data: {
        patientId: patient.id,
        doctorId,
        appointmentDate: parsedDate,
        startTime: parsedTime,
        status: "CONFIRMED",
        queueNumber,
        queueStatus: "WAITING",
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

    // Create notification
    await tx.notification.create({
      data: {
        userId,
        appointmentId: created.id,
        type: "APPOINTMENT_BOOKED",
        message: `Your appointment with Dr. ${doctor.user?.patient?.firstName || "Doctor"} is confirmed.`,
      },
    });

    return created;
  });

  return formatAppointmentPayload(appointment);
}

async function listAppointments(userId, role) {
  const prisma = await getPrismaClient();

  const where = {};
  if (role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) return [];
    where.doctorId = doctor.id;
  } else {
    const patient = await prisma.patient.findUnique({ where: { userId } });
    if (!patient) return [];
    where.patientId = patient.id;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      doctor: {
        include: {
          user: { include: { patient: true } },
          specialties: true,
        },
      },
      patient: true,
    },
    orderBy: [
      { appointmentDate: "desc" },
      { startTime: "desc" },
    ],
  });

  return appointments.map(formatAppointmentPayload);
}

async function getAppointmentById(userId, role, appointmentId) {
  const prisma = await getPrismaClient();

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: {
        include: {
          user: { include: { patient: true } },
          specialties: true,
        },
      },
      patient: {
        include: { user: true },
      },
    },
  });

  if (!appointment) {
    throw new AppointmentError(404, "APPOINTMENT_NOT_FOUND", "Appointment was not found.");
  }

  // Authorization check
  const isPatientOwner = appointment.patient?.userId === userId;
  const isDoctorOwner = appointment.doctor?.userId === userId;

  if (!isPatientOwner && !isDoctorOwner) {
    throw new AppointmentError(403, "FORBIDDEN", "You do not have permission to view this appointment.");
  }

  return formatAppointmentPayload(appointment);
}

async function updateAppointment(userId, role, appointmentId, payload = {}) {
  const prisma = await getPrismaClient();

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
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

  if (!appointment) {
    throw new AppointmentError(404, "APPOINTMENT_NOT_FOUND", "Appointment was not found.");
  }

  const isPatientOwner = appointment.patient?.userId === userId;
  const isDoctorOwner = appointment.doctor?.userId === userId;

  if (!isPatientOwner && !isDoctorOwner) {
    throw new AppointmentError(403, "FORBIDDEN", "You do not have permission to modify this appointment.");
  }

  const { status, appointmentDate, startTime, date, time } = payload;
  const targetDateInput = appointmentDate || date;
  const targetTimeInput = startTime || time;

  // Handle cancellation
  const isCancel = status && status.toUpperCase() === "CANCELLED";
  if (isCancel) {
    if (appointment.status === "COMPLETED") {
      throw new AppointmentError(400, "CANNOT_CANCEL_COMPLETED", "Cannot cancel an appointment that has already been completed.");
    }
    if (appointment.status === "CANCELLED") {
      throw new AppointmentError(400, "ALREADY_CANCELLED", "This appointment is already cancelled.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          queueStatus: "SKIPPED",
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

      await tx.notification.create({
        data: {
          userId,
          appointmentId,
          type: "APPOINTMENT_CANCELLED",
          message: "Your appointment has been cancelled.",
        },
      });

      return res;
    });

    return formatAppointmentPayload(updated);
  }

  // Handle rescheduling
  if (targetDateInput || targetTimeInput) {
    if (appointment.status === "COMPLETED") {
      throw new AppointmentError(400, "CANNOT_RESCHEDULE_COMPLETED", "Cannot reschedule an appointment that has already been completed.");
    }
    if (appointment.status === "CANCELLED") {
      throw new AppointmentError(400, "CANNOT_RESCHEDULE_CANCELLED", "Cannot reschedule a cancelled appointment.");
    }

    const newDate = targetDateInput ? parseAppointmentDate(targetDateInput) : appointment.appointmentDate;
    const newTime = targetTimeInput ? parseStartTime(targetTimeInput) : appointment.startTime;

    if (!newDate) {
      throw new AppointmentError(400, "INVALID_APPOINTMENT_DATE", "Invalid appointment date format.");
    }
    if (!newTime) {
      throw new AppointmentError(400, "INVALID_START_TIME", "Invalid appointment time format.");
    }

    // Prevent past reschedule
    const now = new Date();
    const dateStr = formatDateString(newDate);
    const timeStr = formatTimeString(newTime);
    const combinedDateTime = new Date(`${dateStr}T${timeStr}:00`);
    if (combinedDateTime < now) {
      throw new AppointmentError(400, "PAST_APPOINTMENT_NOT_ALLOWED", "Cannot reschedule an appointment to a time in the past.");
    }

    // Check conflict with other appointments
    const conflict = await prisma.appointment.findFirst({
      where: {
        id: { not: appointmentId },
        doctorId: appointment.doctorId,
        appointmentDate: newDate,
        startTime: newTime,
        status: { not: "CANCELLED" },
      },
    });

    if (conflict) {
      throw new AppointmentError(409, "SLOT_CONFLICT", "The selected time slot is already booked. Please choose another time.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          appointmentDate: newDate,
          startTime: newTime,
          status: "CONFIRMED",
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

      await tx.notification.create({
        data: {
          userId,
          appointmentId,
          type: "APPOINTMENT_STATUS_UPDATED",
          message: `Your appointment has been rescheduled to ${dateStr} at ${timeStr}.`,
        },
      });

      return res;
    });

    return formatAppointmentPayload(updated);
  }

  // Handle doctor status change (e.g. Doctor marks COMPLETED or NO_SHOW)
  if (status && isDoctorOwner) {
    const validStatuses = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
    const upper = status.toUpperCase();
    if (!validStatuses.includes(upper)) {
      throw new AppointmentError(400, "INVALID_STATUS", `Status must be one of: ${validStatuses.join(", ")}`);
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: upper,
        queueStatus: upper === "COMPLETED" ? "COMPLETED" : appointment.queueStatus,
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

    return formatAppointmentPayload(updated);
  }

  return formatAppointmentPayload(appointment);
}

module.exports = {
  AppointmentError,
  bookAppointment,
  listAppointments,
  getAppointmentById,
  updateAppointment,
  formatAppointmentPayload,
};
