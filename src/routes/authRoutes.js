const express = require("express");
const authController = require("./controllers/authController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new patient account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RegistrationSuccess'
 *       400:
 *         description: Validation or input error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/register", authController.register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Sign in to an existing account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Successfully signed in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccessTokenResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", authController.login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get the current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserPublic'
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", authenticate, authController.me);

if (process.env.NODE_ENV !== "production") {
	/**
	 * @openapi
	 * /api/auth/test/patient:
	 *   get:
	 *     summary: Development endpoint for patient-only access validation
	 *     tags: [Auth]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Patient role authorized
	 *       403:
	 *         description: Access forbidden for this role
	 */
	// Development/testing endpoints for verifying role authorization.
	router.get("/test/patient", authenticate, requireRole("PATIENT"), (request, response) => {
		response.status(200).json({
			message: "Patient authorization successful",
			user: request.user,
		});
	});
	/**
	 * @openapi
	 * /api/auth/test/doctor:
	 *   get:
	 *     summary: Development endpoint for doctor-only access validation
	 *     tags: [Auth]
	 *     security:
	 *       - bearerAuth: []
	 *     responses:
	 *       200:
	 *         description: Doctor role authorized
	 *       403:
	 *         description: Access forbidden for this role
	 */
	router.get("/test/doctor", authenticate, requireRole("DOCTOR"), (request, response) => {
		response.status(200).json({
			message: "Doctor authorization successful",
			user: request.user,
		});
	});
}

module.exports = router;
