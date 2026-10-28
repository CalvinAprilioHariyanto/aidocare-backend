# Aido Care — Backend REST API

RESTful API backend for the Aido Care healthcare management application, providing authentication, role-based authorization, doctor directory & working schedules, appointment booking & management, medical records, and prescriptions persistence.

- **Live Backend:** [https://aidocare-backend-production.up.railway.app](https://aidocare-backend-production.up.railway.app/)
- **Swagger Documentation:** [https://aidocare-backend-production.up.railway.app/api-docs](https://aidocare-backend-production.up.railway.app/api-docs) (or `http://localhost:3000/api-docs` locally)
- **Live Frontend:** [https://calvinapriliohariyanto.github.io/aidocare-app/](https://calvinapriliohariyanto.github.io/aidocare-app/)
- **Repository:** [https://github.com/CalvinAprilioHariyanto/aidocare-backend](https://github.com/CalvinAprilioHariyanto/aidocare-backend)

---

## 👥 Team Members

- **Calvin Aprilio Hariyanto** (`calvinuphstudent@gmail.com`)
- **SirImro / Glenn** (`rawglennvids@gmail.com`)
- **Euro William Wijaya** (`eurowijaya123@gmail.com`)

---

## 🛠️ Technology Stack & Architecture

- **Runtime / Framework:** Node.js, Express.js v5
- **Database & ORM:** PostgreSQL, Prisma ORM v7 (`@prisma/adapter-pg`)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`), `bcrypt` (cost factor 12)
- **API Documentation:** Swagger UI Express (`swagger-ui-express`, `swagger-jsdoc`)
- **Testing:** Node.js native test runner (`node --test`)

### System Architecture
The application separates concerns across distinct layers:
1. **Routes (`src/routes/`)**: Define HTTP verbs, paths, authentication/role middlewares, and OpenAPI annotations.
2. **Controllers (`src/routes/controllers/`)**: Handle request extraction, response formatting, and HTTP status codes.
3. **Services (`src/`)**: Pure domain logic and database orchestration (`authService`, `appointmentService`, `doctorService`, `doctorDirectoryService`, `medicalRecordService`, `patientService`).
4. **Data Access Layer (`prisma/schema.prisma` & `generated/prisma`)**: Prisma Client using PostgreSQL adapter.

---

## ⚙️ Prerequisites & Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL database instance
- npm

### Installation
```bash
git clone https://github.com/CalvinAprilioHariyanto/aidocare-backend.git
cd aidocare-backend
npm install
```

### Environment Configuration
Create a `.env` file in the root directory based on `.env.example`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/aido_care?schema=public"
JWT_SECRET=replace-with-at-least-32-random-characters
PORT=3000
```

### Database Migration
Generate Prisma Client and apply migrations safely without dropping production data:
```bash
npx prisma generate
npx prisma migrate dev
```
> [!NOTE]
> Never execute `prisma migrate reset` against production or shared databases.

### Database Seeding (Development Only)
```bash
# In Windows cmd:
set SEED_PASSWORD=YourSecureDevSeedPassword123!
node prisma/seed.cjs

# In Bash / PowerShell:
SEED_PASSWORD=YourSecureDevSeedPassword123! node prisma/seed.cjs
```

---

## 📜 Available Scripts

- `npm test`: Runs the automated test suite using Node's native test runner (`node --test`).
- `npm run dev`: Starts the local development server with `nodemon` watching `src/server.js`.
- `npm start`: Starts the production Express server (`node src/server.js`).

---

## 📡 API Endpoints

### 1. Authentication (`/api/auth`)
- `POST /api/auth/register`: Register a new patient account with encrypted password.
- `POST /api/auth/login`: Authenticate and receive a JWT token.
- `GET /api/auth/me`: Retrieve the authenticated user's profile (`id`, `role`, `email`, `firstName`, `lastName`).

### 2. Doctor Directory & Schedules (`/api/doctors` & `/api/doctor`)
- `GET /api/doctors`: Public directory of doctors with search and specialty filtering (excludes private fields).
- `GET /api/doctors/:id`: Public doctor profile, bio, specialties, and computed availability slots.
- `GET /api/doctor/account`: Fetch doctor account details (requires `DOCTOR` role).
- `PUT /api/doctor/account`: Update doctor details, bio, specialty, and profile name (requires `DOCTOR` role).
- `GET /api/doctor/schedules`: Fetch authenticated doctor's working schedule (requires `DOCTOR` role).

### 3. Appointments (`/api/appointments`)
- `POST /api/appointments`: Book an appointment (authenticated). Validates doctor availability, rejects past dates, checks slot conflicts, assigns queue numbers, and notifies the user.
- `GET /api/appointments`: List appointments belonging to authenticated user (role-appropriate: patient sees their appointments; doctor sees consultations assigned to them).
- `GET /api/appointments/:id`: Retrieve appointment details (verifies user ownership).
- `PATCH /api/appointments/:id`: Reschedule, cancel, or update appointment status with state-transition validation.

### 4. Patients & Medical Records (`/api/patients` & `/api/patient`)
- `GET /api/patients`: List patients (requires `DOCTOR` role).
- `GET /api/patients/:id`: Fetch patient details and consultation history.
- `GET /api/patients/:id/records`: List medical records for a patient (patients can only view their own records; doctors can view).
- `POST /api/patients/:id/records`: Create a medical record with diagnosis, symptoms, treatment plan, and prescription persistence (requires `DOCTOR` role).
- `GET /api/patients/:id/records/:recordId`: Retrieve specific record details.
- `PATCH /api/patients/:id/records/:recordId`: Update or archive a medical record (requires `DOCTOR` role).
- `GET /api/patient/profile`: Fetch patient health profile (requires `PATIENT` role).
- `PUT /api/patient/profile`: Update patient profile fields (phone, date of birth, gender, allergies).

### 5. API Documentation
- `GET /api-docs`: Interactive Swagger UI.
- `GET /api-docs.json`: Raw OpenAPI specification.

---

## 🌐 Deployment

The backend is deployed to Railway with continuous deployment from GitHub:
- Target: `https://aidocare-backend-production.up.railway.app`
- Database: Managed PostgreSQL hosted on Railway
