const express = require("express");
const medicalRecordController = require("./controllers/medicalRecordController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * @openapi
 * /api/patients:
 *   get:
 *     summary: List patients (Healthcare providers only)
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of patients
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (Doctor role required)
 */
router.get("/", authenticate, requireRole("DOCTOR"), medicalRecordController.listPatients);

/**
 * @openapi
 * /api/patients/{id}:
 *   get:
 *     summary: Get patient details
 *     tags: [Patients]
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
 *         description: Patient details
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Patient not found
 */
router.get("/:id", authenticate, medicalRecordController.getPatientDetails);

/**
 * @openapi
 * /api/patients/{id}/records:
 *   get:
 *     summary: List medical records for a patient
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeArchived
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of medical records
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (Patient cannot view other patients' records)
 */
router.get("/:id/records", authenticate, medicalRecordController.listPatientRecords);

/**
 * @openapi
 * /api/patients/{id}/records:
 *   post:
 *     summary: Create a medical record for a patient (Doctors only)
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               symptoms:
 *                 type: string
 *               diagnosis:
 *                 type: string
 *               treatment:
 *                 type: string
 *               notes:
 *                 type: string
 *               prescriptions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Medical record created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden (Patients cannot create records)
 *       404:
 *         description: Patient not found
 */
router.post("/:id/records", authenticate, requireRole("DOCTOR"), medicalRecordController.createMedicalRecord);

/**
 * @openapi
 * /api/patients/{id}/records/{recordId}:
 *   get:
 *     summary: Get a specific medical record
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Medical record details
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Record not found
 */
router.get("/:id/records/:recordId", authenticate, medicalRecordController.getMedicalRecordById);

/**
 * @openapi
 * /api/patients/{id}/records/{recordId}:
 *   patch:
 *     summary: Update or archive a medical record (Doctors only)
 *     tags: [Medical Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               symptoms:
 *                 type: string
 *               diagnosis:
 *                 type: string
 *               treatment:
 *                 type: string
 *               notes:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, ARCHIVED]
 *               prescriptions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Medical record updated successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Record not found
 */
router.patch("/:id/records/:recordId", authenticate, requireRole("DOCTOR"), medicalRecordController.updateMedicalRecord);

module.exports = router;
