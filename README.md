# Aido Care Backend

Backend REST API for **Aido Care**, a healthcare web application that connects patients and doctors through authentication, appointments, patient information, medical records, prescriptions, and role-based access.

The backend provides secure API services, authentication, authorization, database management, and healthcare-related data processing for the Aido Care frontend.

---

## Tech Stack

- **Node.js** — JavaScript runtime
- **Express.js** — Backend web framework
- **Prisma ORM** — Database ORM and schema management
- **PostgreSQL** — Relational database
- **JWT** — Authentication and authorization
- **bcrypt** — Password hashing
- **REST API** — Client-server communication
- **Railway** — Backend and database deployment
- **Git & GitHub** — Version control

---

## Features

### Authentication & Authorization

- User registration
- User login
- JWT-based authentication
- Authenticated user information
- Password hashing with bcrypt
- Role-based authorization
- Patient and Doctor roles
- Protected API endpoints

### Doctor Account

- View doctor account information
- Update doctor account information
- Doctor-specific authorization

### Patient Management

- Patient information management
- Patient profile access
- Role-protected patient resources

### Appointments

- Appointment data management
- Appointment status handling
- Doctor and patient appointment relationships

### Medical Records

- Medical record management
- Patient medical history
- Doctor-specific access control

### Prescriptions

- Prescription management
- Medication information
- Prescription status management
- Doctor authorization

> Some healthcare modules may depend on the current frontend/backend implementation and database state.

---

## API Overview

### Authentication

| Method | Endpoint | Authentication |
|---|---|---|
| `POST` | `/api/auth/register` | Public |
| `POST` | `/api/auth/login` | Public |
| `GET` | `/api/auth/me` | JWT Required |

### Doctor

| Method | Endpoint | Authentication |
|---|---|---|
| `GET` | `/api/doctor/account` | Doctor |
| `PUT` | `/api/doctor/account` | Doctor |

Additional endpoints can be added as the healthcare modules are expanded.

---

## Authentication

Aido Care uses **JWT Bearer Authentication**.

After a successful login, the API returns an authentication token.

Protected requests must include:

```http
Authorization: Bearer YOUR_JWT_TOKEN
