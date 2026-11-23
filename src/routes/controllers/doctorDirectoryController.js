const doctorDirectoryService = require("../../doctorDirectoryService");

async function listDoctors(request, response, next) {
  try {
    const { search, specialty } = request.query;
    const doctors = await doctorDirectoryService.listDoctors({ search, specialty });
    return response.status(200).json({ doctors });
  } catch (error) {
    if (error instanceof doctorDirectoryService.DoctorDirectoryError) {
      return response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
    }
    return next(error);
  }
}

async function getDoctorById(request, response, next) {
  try {
    const { id } = request.params;
    const doctor = await doctorDirectoryService.getDoctorById(id);
    return response.status(200).json({ doctor });
  } catch (error) {
    if (error instanceof doctorDirectoryService.DoctorDirectoryError) {
      return response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
    }
    return next(error);
  }
}

async function getDoctorSchedules(request, response, next) {
  try {
    const schedules = await doctorDirectoryService.getDoctorSchedules(request.user.id);
    return response.status(200).json({ schedules });
  } catch (error) {
    if (error instanceof doctorDirectoryService.DoctorDirectoryError) {
      return response.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
    }
    return next(error);
  }
}

module.exports = {
  listDoctors,
  getDoctorById,
  getDoctorSchedules,
};
