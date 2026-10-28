const medicalRecordService = require("../../medicalRecordService");

function sendError(response, error, next) {
  if (error instanceof medicalRecordService.MedicalRecordError) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }
  return next(error);
}

async function listPatientRecords(request, response, next) {
  try {
    const includeArchived = request.query.includeArchived === "true";
    const records = await medicalRecordService.listPatientRecords(
      request.user.id,
      request.user.role,
      request.params.id,
      { includeArchived }
    );
    return response.status(200).json({ records });
  } catch (error) {
    return sendError(response, error, next);
  }
}

async function getMedicalRecordById(request, response, next) {
  try {
    const record = await medicalRecordService.getMedicalRecordById(
      request.user.id,
      request.user.role,
      request.params.id,
      request.params.recordId
    );
    return response.status(200).json({ record });
  } catch (error) {
    return sendError(response, error, next);
  }
}

async function createMedicalRecord(request, response, next) {
  try {
    const record = await medicalRecordService.createMedicalRecord(
      request.user.id,
      request.user.role,
      request.params.id,
      request.body
    );
    return response.status(201).json({
      message: "Medical record created successfully",
      record,
    });
  } catch (error) {
    return sendError(response, error, next);
  }
}

async function updateMedicalRecord(request, response, next) {
  try {
    const record = await medicalRecordService.updateMedicalRecord(
      request.user.id,
      request.user.role,
      request.params.id,
      request.params.recordId,
      request.body
    );
    return response.status(200).json({
      message: "Medical record updated successfully",
      record,
    });
  } catch (error) {
    return sendError(response, error, next);
  }
}

async function listPatients(request, response, next) {
  try {
    const patients = await medicalRecordService.listPatients(
      request.user.id,
      request.user.role
    );
    return response.status(200).json({ patients });
  } catch (error) {
    return sendError(response, error, next);
  }
}

async function getPatientDetails(request, response, next) {
  try {
    const patient = await medicalRecordService.getPatientDetails(
      request.user.id,
      request.user.role,
      request.params.id
    );
    return response.status(200).json({ patient });
  } catch (error) {
    return sendError(response, error, next);
  }
}

module.exports = {
  listPatientRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  listPatients,
  getPatientDetails,
};
