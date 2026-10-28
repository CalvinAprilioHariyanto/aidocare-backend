const express = require("express");
const doctorController = require("./controllers/doctorController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * @openapi
 * /api/doctor/account:
 *   get:
 *     summary: Get doctor account details
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Doctor account details
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (Doctor role required)
 *       404:
 *         description: Doctor profile not found
 */
router.get("/account", authenticate, requireRole("DOCTOR"), doctorController.getAccount);

/**
 * @openapi
 * /api/doctor/account:
 *   put:
 *     summary: Update doctor account details
 *     tags: [Doctor]
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
 *               specialty:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Doctor account updated
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 */
router.put("/account", authenticate, requireRole("DOCTOR"), doctorController.updateAccount);

/**
 * @openapi
 * /api/doctor/schedules:
 *   get:
 *     summary: Get authenticated doctor's working schedules
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of schedules for the doctor
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (Doctor role required)
 */
router.get("/schedules", authenticate, requireRole("DOCTOR"), doctorController.getSchedules);

module.exports = router;
