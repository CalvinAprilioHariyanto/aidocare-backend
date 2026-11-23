const express = require("express");
const doctorDirectoryController = require("./controllers/doctorDirectoryController");

const router = express.Router();

/**
 * @openapi
 * /api/doctors:
 *   get:
 *     summary: List all doctors with public profiles
 *     tags: [Doctors]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query matching doctor name or specialty
 *       - in: query
 *         name: specialty
 *         schema:
 *           type: string
 *         description: Filter by specialty name
 *     responses:
 *       200:
 *         description: List of doctors
 */
router.get("/", doctorDirectoryController.listDoctors);

/**
 * @openapi
 * /api/doctors/{id}:
 *   get:
 *     summary: Get public doctor profile and availability
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Doctor ID
 *     responses:
 *       200:
 *         description: Doctor profile
 *       404:
 *         description: Doctor not found
 */
router.get("/:id", doctorDirectoryController.getDoctorById);

module.exports = router;
