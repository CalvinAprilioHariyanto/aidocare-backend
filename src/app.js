const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const doctorsRoutes = require("./routes/doctorsRoutes");
const patientRoutes = require("./routes/patientRoutes");
const patientsRoutes = require("./routes/patientsRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const cors = require("cors");

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://calvinapriliohariyanto.github.io"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: "Aido Care API Docs",
}));
app.get("/api-docs.json", (request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.send(swaggerSpec);
});

app.use("/api/auth", authRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/appointments", appointmentRoutes);

app.use((request, response) => {
	response.status(404).json({
		error: { code: "NOT_FOUND", message: "The requested endpoint was not found." },
	});
});

app.use((error, request, response, next) => {
	if (response.headersSent) {
		return next(error);
	}

	if (error.type === "entity.parse.failed") {
		return response.status(400).json({
			error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." },
		});
	}

	if (error.type === "entity.too.large") {
		return response.status(413).json({
			error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large." },
		});
	}

	return response.status(500).json({
		error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." },
	});
});

module.exports = app;
