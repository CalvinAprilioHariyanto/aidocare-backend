require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaPg } = require("@prisma/adapter-pg");

const users = [
  { id: "10000000-0000-4000-8000-000000000001", email: "patient.one@example.test", role: "PATIENT" },
  { id: "10000000-0000-4000-8000-000000000002", email: "patient.two@example.test", role: "PATIENT" },
  { id: "10000000-0000-4000-8000-000000000003", email: "patient.three@example.test", role: "PATIENT" },
  { id: "20000000-0000-4000-8000-000000000001", email: "doctor.one@example.test", role: "DOCTOR" },
  { id: "20000000-0000-4000-8000-000000000002", email: "doctor.two@example.test", role: "DOCTOR" },
  { id: "20000000-0000-4000-8000-000000000003", email: "doctor.three@example.test", role: "DOCTOR" },
];

const patients = [
  { id: "30000000-0000-4000-8000-000000000001", userId: users[0].id, phone: "+1-555-0101", dateOfBirth: new Date("1990-04-12T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000002", userId: users[1].id, phone: "+1-555-0102", dateOfBirth: new Date("1984-09-23T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000003", userId: users[2].id, phone: "+1-555-0103", dateOfBirth: new Date("2001-01-08T00:00:00.000Z") },
];

const specialties = [
  { id: "40000000-0000-4000-8000-000000000001", name: "General Practice" },
  { id: "40000000-0000-4000-8000-000000000002", name: "Cardiology" },
  { id: "40000000-0000-4000-8000-000000000003", name: "Dermatology" },
];

const doctors = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    userId: users[3].id,
    licenseNumber: "DEV-LIC-0001",
    bio: "Fictional development profile for general practice and preventive care.",
    specialties: ["General Practice", "Cardiology"],
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    userId: users[4].id,
    licenseNumber: "DEV-LIC-0002",
    bio: "Fictional development profile for heart health consultations.",
    specialties: ["Cardiology", "Dermatology"],
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    userId: users[5].id,
    licenseNumber: "DEV-LIC-0003",
    bio: "Fictional development profile for general and skin health consultations.",
    specialties: ["General Practice", "Dermatology"],
  },
];

const time = (value) => new Date(`1970-01-01T${value}:00.000Z`);
const schedules = [
  { id: "60000000-0000-4000-8000-000000000001", doctorId: doctors[0].id, dayOfWeek: "MONDAY", startTime: time("09:00"), endTime: time("12:00") },
  { id: "60000000-0000-4000-8000-000000000002", doctorId: doctors[0].id, dayOfWeek: "WEDNESDAY", startTime: time("13:00"), endTime: time("16:00") },
  { id: "60000000-0000-4000-8000-000000000003", doctorId: doctors[1].id, dayOfWeek: "TUESDAY", startTime: time("10:00"), endTime: time("14:00") },
  { id: "60000000-0000-4000-8000-000000000004", doctorId: doctors[1].id, dayOfWeek: "THURSDAY", startTime: time("09:00"), endTime: time("12:00") },
  { id: "60000000-0000-4000-8000-000000000005", doctorId: doctors[2].id, dayOfWeek: "FRIDAY", startTime: time("09:00"), endTime: time("13:00") },
  { id: "60000000-0000-4000-8000-000000000006", doctorId: doctors[2].id, dayOfWeek: "SATURDAY", startTime: time("10:00"), endTime: time("12:00") },
];

const appointments = [
  { id: "70000000-0000-4000-8000-000000000001", patientId: patients[0].id, doctorId: doctors[0].id, appointmentDate: new Date("2026-10-05T00:00:00.000Z"), startTime: time("09:00"), status: "PENDING", queueNumber: 1, queueStatus: "WAITING" },
  { id: "70000000-0000-4000-8000-000000000002", patientId: patients[1].id, doctorId: doctors[1].id, appointmentDate: new Date("2026-10-06T00:00:00.000Z"), startTime: time("10:00"), status: "CONFIRMED", queueNumber: 1, queueStatus: "CALLED" },
  { id: "70000000-0000-4000-8000-000000000003", patientId: patients[2].id, doctorId: doctors[2].id, appointmentDate: new Date("2026-09-14T00:00:00.000Z"), startTime: time("11:00"), status: "COMPLETED", queueNumber: 1, queueStatus: "COMPLETED" },
  { id: "70000000-0000-4000-8000-000000000004", patientId: patients[0].id, doctorId: doctors[1].id, appointmentDate: new Date("2026-10-08T00:00:00.000Z"), startTime: time("11:00"), status: "CANCELLED", queueNumber: 2, queueStatus: "SKIPPED", cancelledAt: new Date("2026-09-20T12:00:00.000Z") },
];

const medicalRecords = [
  { id: "80000000-0000-4000-8000-000000000001", patientId: patients[0].id, doctorId: doctors[0].id, title: "Routine wellness visit", content: "Fictional development record. Routine wellness consultation; follow-up as needed." },
  { id: "80000000-0000-4000-8000-000000000002", patientId: patients[1].id, doctorId: doctors[1].id, title: "Cardiology consultation", content: "Fictional development record. Initial consultation completed; routine follow-up recommended." },
  { id: "80000000-0000-4000-8000-000000000003", patientId: patients[2].id, doctorId: doctors[2].id, title: "Skin health consultation", content: "Fictional development record. General skin health consultation; no urgent follow-up noted." },
];

const notifications = [
  { id: "90000000-0000-4000-8000-000000000001", userId: users[0].id, appointmentId: appointments[0].id, type: "APPOINTMENT_BOOKED", message: "Your development appointment request is pending." },
  { id: "90000000-0000-4000-8000-000000000002", userId: users[1].id, appointmentId: appointments[1].id, type: "APPOINTMENT_STATUS_UPDATED", message: "Your development appointment is confirmed." },
  { id: "90000000-0000-4000-8000-000000000003", userId: users[2].id, appointmentId: appointments[2].id, type: "QUEUE_STATUS_UPDATED", message: "Your development appointment queue is complete." },
  { id: "90000000-0000-4000-8000-000000000004", userId: users[0].id, appointmentId: appointments[3].id, type: "APPOINTMENT_CANCELLED", message: "Your development appointment was cancelled." },
];

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    throw new Error("Set SEED_PASSWORD in the local environment before running the development seed.");
  }

  const [{ PrismaClient }, passwordHash] = await Promise.all([
    import("../generated/prisma/client.ts"),
    bcrypt.hash(seedPassword, 12),
  ]);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const user of users) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: { role: user.role, passwordHash },
        create: { ...user, passwordHash },
      });
    }

    for (const patient of patients) {
      const { id, ...data } = patient;
      await prisma.patient.upsert({
        where: { userId: patient.userId },
        update: data,
        create: patient,
      });
    }

    for (const specialty of specialties) {
      await prisma.specialty.upsert({
        where: { name: specialty.name },
        update: {},
        create: specialty,
      });
    }

    for (const doctor of doctors) {
      const { specialties: doctorSpecialties, ...data } = doctor;
      const specialtyLinks = {
        connect: doctorSpecialties.map((name) => ({ name })),
      };
      await prisma.doctor.upsert({
        where: { userId: doctor.userId },
        update: { licenseNumber: doctor.licenseNumber, bio: doctor.bio, specialties: specialtyLinks },
        create: { ...data, specialties: specialtyLinks },
      });
    }

    for (const schedule of schedules) {
      const { id, ...data } = schedule;
      await prisma.doctorSchedule.upsert({
        where: {
          doctorId_dayOfWeek_startTime: {
            doctorId: schedule.doctorId,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
          },
        },
        update: { endTime: schedule.endTime, isActive: true },
        create: schedule,
      });
    }

    for (const appointment of appointments) {
      await prisma.appointment.upsert({
        where: {
          doctorId_appointmentDate_queueNumber: {
            doctorId: appointment.doctorId,
            appointmentDate: appointment.appointmentDate,
            queueNumber: appointment.queueNumber,
          },
        },
        update: appointment,
        create: appointment,
      });
    }

    for (const record of medicalRecords) {
      await prisma.medicalRecord.upsert({
        where: { id: record.id },
        update: { patientId: record.patientId, doctorId: record.doctorId, title: record.title, content: record.content },
        create: record,
      });
    }

    for (const notification of notifications) {
      await prisma.notification.upsert({
        where: { id: notification.id },
        update: { userId: notification.userId, appointmentId: notification.appointmentId, type: notification.type, message: notification.message },
        create: notification,
      });
    }

    const counts = await Promise.all([
      prisma.user.count(),
      prisma.patient.count(),
      prisma.doctor.count(),
      prisma.specialty.count(),
      prisma.doctorSchedule.count(),
      prisma.appointment.count(),
      prisma.medicalRecord.count(),
      prisma.notification.count(),
    ]);

    console.log("Development seed record counts:");
    ["users", "patients", "doctors", "specialties", "schedules", "appointments", "medical records", "notifications"]
      .forEach((label, index) => console.log(`${label}: ${counts[index]}`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
