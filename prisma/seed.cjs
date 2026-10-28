require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaPg } = require("@prisma/adapter-pg");

const userDefs = [
  { id: "10000000-0000-4000-8000-000000000001", email: "patient.one@example.test", role: "PATIENT" },
  { id: "10000000-0000-4000-8000-000000000002", email: "patient.two@example.test", role: "PATIENT" },
  { id: "10000000-0000-4000-8000-000000000003", email: "patient.three@example.test", role: "PATIENT" },
  { id: "10000000-0000-4000-8000-000000000004", email: "sarah.wijaya@test.com", role: "PATIENT" },
  { id: "10000000-0000-4000-8000-000000000005", email: "patient@aidocare.com", role: "PATIENT" },
  { id: "20000000-0000-4000-8000-000000000001", email: "doctor.one@example.test", role: "DOCTOR" },
  { id: "20000000-0000-4000-8000-000000000002", email: "doctor.two@example.test", role: "DOCTOR" },
  { id: "20000000-0000-4000-8000-000000000003", email: "doctor.three@example.test", role: "DOCTOR" },
  { id: "20000000-0000-4000-8000-000000000004", email: "doctor@aidocare.com", role: "DOCTOR" },
];

const specificPasswords = {
  "sarah.wijaya@test.com": "SarahTest123!",
  "doctor.one@example.test": "DoctorTest123!",
  "patient@aidocare.com": "Password123!",
  "doctor@aidocare.com": "Password123!",
};

const patientDefs = [
  { id: "30000000-0000-4000-8000-000000000001", userEmail: "patient.one@example.test", firstName: "John", lastName: "Doe", phone: "+1-555-0101", dateOfBirth: new Date("1990-04-12T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000002", userEmail: "patient.two@example.test", firstName: "Jane", lastName: "Smith", phone: "+1-555-0102", dateOfBirth: new Date("1984-09-23T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000003", userEmail: "patient.three@example.test", firstName: "Alex", lastName: "Taylor", phone: "+1-555-0103", dateOfBirth: new Date("2001-01-08T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000004", userEmail: "sarah.wijaya@test.com", firstName: "Sarah", lastName: "Wijaya", phone: "+62 812 9876 5432", dateOfBirth: new Date("1996-05-20T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000005", userEmail: "patient@aidocare.com", firstName: "Calvin", lastName: "Patient", phone: "+62 812 3456 7890", dateOfBirth: new Date("2005-04-12T00:00:00.000Z") },
  // Doctor profile names attached to doctor user accounts
  { id: "30000000-0000-4000-8000-000000000006", userEmail: "doctor.one@example.test", firstName: "Sarah", lastName: "Anderson", phone: "+1-555-0201", dateOfBirth: new Date("1980-03-15T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000007", userEmail: "doctor.two@example.test", firstName: "David", lastName: "Chen", phone: "+1-555-0202", dateOfBirth: new Date("1982-07-22T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000008", userEmail: "doctor.three@example.test", firstName: "Emily", lastName: "Rodriguez", phone: "+1-555-0203", dateOfBirth: new Date("1985-11-30T00:00:00.000Z") },
  { id: "30000000-0000-4000-8000-000000000009", userEmail: "doctor@aidocare.com", firstName: "Sarah", lastName: "Anderson", phone: "+62 811 2345 6789", dateOfBirth: new Date("1980-03-15T00:00:00.000Z") },
];

const specialties = [
  { id: "40000000-0000-4000-8000-000000000001", name: "General Practice" },
  { id: "40000000-0000-4000-8000-000000000002", name: "Cardiology" },
  { id: "40000000-0000-4000-8000-000000000003", name: "Dermatology" },
];

const doctorDefs = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    userEmail: "doctor.one@example.test",
    licenseNumber: "DEV-LIC-0001",
    bio: "Fictional development profile for general practice and preventive care.",
    specialties: ["General Practice", "Cardiology"],
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    userEmail: "doctor.two@example.test",
    licenseNumber: "DEV-LIC-0002",
    bio: "Fictional development profile for heart health consultations.",
    specialties: ["Cardiology", "Dermatology"],
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    userEmail: "doctor.three@example.test",
    licenseNumber: "DEV-LIC-0003",
    bio: "Fictional development profile for general and skin health consultations.",
    specialties: ["General Practice", "Dermatology"],
  },
  {
    id: "50000000-0000-4000-8000-000000000004",
    userEmail: "doctor@aidocare.com",
    licenseNumber: "DOC-2026-001",
    bio: "Fictional development profile for Dr. Sarah Anderson.",
    specialties: ["General Practice"],
  },
];

const time = (value) => new Date(`1970-01-01T${value}:00.000Z`);

async function main() {
  const seedPassword = process.env.SEED_PASSWORD || "Password123!";
  const defaultHash = await bcrypt.hash(seedPassword, 12);

  const passwordHashes = {};
  for (const [email, pwd] of Object.entries(specificPasswords)) {
    passwordHashes[email] = await bcrypt.hash(pwd, 12);
  }

  const [{ PrismaClient }] = await Promise.all([
    import("../generated/prisma/client.ts"),
  ]);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const userMap = {};
    for (const user of userDefs) {
      const passwordHash = passwordHashes[user.email] || defaultHash;
      const saved = await prisma.user.upsert({
        where: { email: user.email },
        update: { role: user.role, passwordHash },
        create: { id: user.id, email: user.email, role: user.role, passwordHash },
      });
      userMap[user.email] = saved.id;
    }

    const patientMap = {};
    for (const p of patientDefs) {
      const userId = userMap[p.userEmail];
      if (!userId) continue;

      const { id, userEmail, ...data } = p;
      const saved = await prisma.patient.upsert({
        where: { userId },
        update: { ...data },
        create: { id, userId, ...data },
      });
      patientMap[p.userEmail] = saved.id;
    }

    for (const specialty of specialties) {
      await prisma.specialty.upsert({
        where: { name: specialty.name },
        update: {},
        create: specialty,
      });
    }

    const doctorMap = {};
    for (const doc of doctorDefs) {
      const userId = userMap[doc.userEmail];
      if (!userId) continue;

      const { id, userEmail, specialties: doctorSpecialties, ...data } = doc;
      const specialtyLinks = {
        connect: doctorSpecialties.map((name) => ({ name })),
      };
      const saved = await prisma.doctor.upsert({
        where: { userId },
        update: { licenseNumber: doc.licenseNumber, bio: doc.bio, specialties: specialtyLinks },
        create: { id, userId, licenseNumber: doc.licenseNumber, bio: doc.bio, specialties: specialtyLinks },
      });
      doctorMap[doc.userEmail] = saved.id;
    }

    const primaryDocId = doctorMap["doctor.one@example.test"];
    const secondDocId = doctorMap["doctor.two@example.test"];
    const thirdDocId = doctorMap["doctor.three@example.test"];
    const defaultDocId = doctorMap["doctor@aidocare.com"] || primaryDocId;

    if (primaryDocId && secondDocId && thirdDocId) {
      const schedules = [
        { id: "60000000-0000-4000-8000-000000000001", doctorId: primaryDocId, dayOfWeek: "MONDAY", startTime: time("09:00"), endTime: time("12:00") },
        { id: "60000000-0000-4000-8000-000000000002", doctorId: primaryDocId, dayOfWeek: "WEDNESDAY", startTime: time("13:00"), endTime: time("16:00") },
        { id: "60000000-0000-4000-8000-000000000003", doctorId: secondDocId, dayOfWeek: "TUESDAY", startTime: time("10:00"), endTime: time("14:00") },
        { id: "60000000-0000-4000-8000-000000000004", doctorId: secondDocId, dayOfWeek: "THURSDAY", startTime: time("09:00"), endTime: time("12:00") },
        { id: "60000000-0000-4000-8000-000000000005", doctorId: thirdDocId, dayOfWeek: "FRIDAY", startTime: time("09:00"), endTime: time("13:00") },
        { id: "60000000-0000-4000-8000-000000000006", doctorId: thirdDocId, dayOfWeek: "SATURDAY", startTime: time("10:00"), endTime: time("12:00") },
        { id: "60000000-0000-4000-8000-000000000007", doctorId: defaultDocId, dayOfWeek: "MONDAY", startTime: time("09:00"), endTime: time("15:00") },
      ];

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
    }

    const patient1Id = patientMap["patient.one@example.test"];
    const patient2Id = patientMap["patient.two@example.test"];
    const patient3Id = patientMap["patient.three@example.test"];

    if (patient1Id && patient2Id && patient3Id && primaryDocId && secondDocId && thirdDocId) {
      const appointments = [
        { id: "70000000-0000-4000-8000-000000000001", patientId: patient1Id, doctorId: primaryDocId, appointmentDate: new Date("2026-10-05T00:00:00.000Z"), startTime: time("09:00"), status: "PENDING", queueNumber: 1, queueStatus: "WAITING" },
        { id: "70000000-0000-4000-8000-000000000002", patientId: patient2Id, doctorId: secondDocId, appointmentDate: new Date("2026-10-06T00:00:00.000Z"), startTime: time("10:00"), status: "CONFIRMED", queueNumber: 1, queueStatus: "CALLED" },
        { id: "70000000-0000-4000-8000-000000000003", patientId: patient3Id, doctorId: thirdDocId, appointmentDate: new Date("2026-09-14T00:00:00.000Z"), startTime: time("11:00"), status: "COMPLETED", queueNumber: 1, queueStatus: "COMPLETED" },
        { id: "70000000-0000-4000-8000-000000000004", patientId: patient1Id, doctorId: secondDocId, appointmentDate: new Date("2026-10-08T00:00:00.000Z"), startTime: time("11:00"), status: "CANCELLED", queueNumber: 2, queueStatus: "SKIPPED", cancelledAt: new Date("2026-09-20T12:00:00.000Z") },
      ];

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

      const medicalRecords = [
        { id: "80000000-0000-4000-8000-000000000001", patientId: patient1Id, doctorId: primaryDocId, title: "Routine wellness visit", content: "Fictional development record. Routine wellness consultation; follow-up as needed." },
        { id: "80000000-0000-4000-8000-000000000002", patientId: patient2Id, doctorId: secondDocId, title: "Cardiology consultation", content: "Fictional development record. Initial consultation completed; routine follow-up recommended." },
        { id: "80000000-0000-4000-8000-000000000003", patientId: patient3Id, doctorId: thirdDocId, title: "Skin health consultation", content: "Fictional development record. General skin health consultation; no urgent follow-up noted." },
      ];

      for (const record of medicalRecords) {
        await prisma.medicalRecord.upsert({
          where: { id: record.id },
          update: { patientId: record.patientId, doctorId: record.doctorId, title: record.title, content: record.content },
          create: record,
        });
      }

      const user1Id = userMap["patient.one@example.test"];
      const user2Id = userMap["patient.two@example.test"];
      const user3Id = userMap["patient.three@example.test"];

      if (user1Id && user2Id && user3Id) {
        const notifications = [
          { id: "90000000-0000-4000-8000-000000000001", userId: user1Id, appointmentId: appointments[0].id, type: "APPOINTMENT_BOOKED", message: "Your development appointment request is pending." },
          { id: "90000000-0000-4000-8000-000000000002", userId: user2Id, appointmentId: appointments[1].id, type: "APPOINTMENT_STATUS_UPDATED", message: "Your development appointment is confirmed." },
          { id: "90000000-0000-4000-8000-000000000003", userId: user3Id, appointmentId: appointments[2].id, type: "QUEUE_STATUS_UPDATED", message: "Your development appointment queue is complete." },
          { id: "90000000-0000-4000-8000-000000000004", userId: user1Id, appointmentId: appointments[3].id, type: "APPOINTMENT_CANCELLED", message: "Your development appointment was cancelled." },
        ];

        for (const notification of notifications) {
          await prisma.notification.upsert({
            where: { id: notification.id },
            update: { userId: notification.userId, appointmentId: notification.appointmentId, type: notification.type, message: notification.message },
            create: notification,
          });
        }
      }
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
