const patientService = require("../../patientService");

function sendError(response, error) {
  if (error.status && error.code) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  console.error("[patientController] error:", error);
  return response.status(500).json({
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." },
  });
}

async function getProfile(request, response) {
  try {
    const profile = await patientService.getPatientProfile(request.user.id);
    return response.status(200).json({ profile });
  } catch (error) {
    return sendError(response, error);
  }
}

async function updateProfile(request, response) {
  try {
    const profile = await patientService.updatePatientProfile(request.user.id, request.body);
    return response.status(200).json({
      message: "Patient profile updated successfully",
      profile,
    });
  } catch (error) {
    return sendError(response, error);
  }
}

module.exports = {
  getProfile,
  updateProfile,
};
