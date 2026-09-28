const express = require("express");
const authController = require("./controllers/authController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.me);

if (process.env.NODE_ENV !== "production") {
	// Development/testing endpoints for verifying role authorization.
	router.get("/test/patient", authenticate, requireRole("PATIENT"), (request, response) => {
		response.status(200).json({
			message: "Patient authorization successful",
			user: request.user,
		});
	});
	router.get("/test/doctor", authenticate, requireRole("DOCTOR"), (request, response) => {
		response.status(200).json({
			message: "Doctor authorization successful",
			user: request.user,
		});
	});
}

module.exports = router;
