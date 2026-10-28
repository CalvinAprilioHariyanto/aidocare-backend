const doctorService = require("../../doctorService");

function sendError(response, error) {
  if (error.status && error.code) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  console.error("[doctorController] error:", error);
  return response.status(500).json({
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." },
  });
}

async function getAccount(request, response) {
  try {
    const doctor = await doctorService.getDoctorAccount(request.user.id);
    return response.status(200).json({ doctor });
  } catch (error) {
    return sendError(response, error);
  }
}

async function updateAccount(request, response) {
  try {
    const doctor = await doctorService.updateDoctorAccount(request.user.id, request.body);
    return response.status(200).json({
      message: "Doctor account updated successfully",
      doctor,
    });
  } catch (error) {
    return sendError(response, error);
  }
}

const doctorDirectoryService = require("../../doctorDirectoryService");

async function getSchedules(request, response) {
  try {
    const schedules = await doctorDirectoryService.getDoctorSchedules(request.user.id);
    return response.status(200).json({ schedules });
  } catch (error) {
    return sendError(response, error);
  }
}

module.exports = {
  getAccount,
  updateAccount,
  getSchedules,
};
