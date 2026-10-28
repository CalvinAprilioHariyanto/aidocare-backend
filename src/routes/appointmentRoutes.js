const express = require("express");
const appointmentController = require("./controllers/appointmentController");
const { authenticate } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * @openapi
 * /api/appointments:
 *   post:
 *     summary: Book an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctorId
 *               - appointmentDate
 *               - startTime
 *             properties:
 *               doctorId:
 *                 type: string
 *               appointmentDate:
 *                 type: string
 *                 example: "2026-11-15"
 *               startTime:
 *                 type: string
 *                 example: "09:30"
 *     responses:
 *       201:
 *         description: Appointment booked successfully
 *       400:
 *         description: Validation error or past date
 *       401:
 *         description: Authentication required
 *       409:
 *         description: Slot conflict
 */
router.post("/", authenticate, appointmentController.bookAppointment);

/**
 * @openapi
 * /api/appointments:
 *   get:
 *     summary: List appointments belonging to authenticated user
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of appointments
 *       401:
 *         description: Authentication required
 */
router.get("/", authenticate, appointmentController.listAppointments);

/**
 * @openapi
 * /api/appointments/{id}:
 *   get:
 *     summary: Get appointment details by ID
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Appointment details
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (Not appointment owner)
 *       404:
 *         description: Appointment not found
 */
router.get("/:id", authenticate, appointmentController.getAppointmentById);

/**
 * @openapi
 * /api/appointments/{id}:
 *   patch:
 *     summary: Reschedule, cancel, or update appointment status
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CANCELLED, CONFIRMED, COMPLETED, NO_SHOW]
 *               appointmentDate:
 *                 type: string
 *               startTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: Appointment updated
 *       400:
 *         description: Invalid transition or past date
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Slot conflict during reschedule
 */
router.patch("/:id", authenticate, appointmentController.updateAppointment);

module.exports = router;
