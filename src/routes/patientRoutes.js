const express = require("express");
const patientController = require("./controllers/patientController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * @openapi
 * /api/patient/profile:
 *   get:
 *     summary: Get patient health profile
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patient health profile
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (Patient role required)
 *       404:
 *         description: Patient profile not found
 */
router.get("/profile", authenticate, requireRole("PATIENT"), patientController.getProfile);

/**
 * @openapi
 * /api/patient/profile:
 *   put:
 *     summary: Update patient health profile
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *               gender:
 *                 type: string
 *               allergies:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Patient health profile updated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 */
router.put("/profile", authenticate, requireRole("PATIENT"), patientController.updateProfile);

module.exports = router;
