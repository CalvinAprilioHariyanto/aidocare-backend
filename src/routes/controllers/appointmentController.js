const appointmentService = require("../../appointmentService");

function sendError(response, error, next) {
  if (error instanceof appointmentService.AppointmentError) {
    return response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }
  return next(error);
}

async function bookAppointment(request, response, next) {
  try {
    const appointment = await appointmentService.bookAppointment(
      request.user.id,
      request.user.role,
      request.body
    );
    return response.status(201).json({
      message: "Appointment booked successfully",
      appointment,
    });
  } catch (error) {
    return sendError(response, error, next);
  }
}

async function listAppointments(request, response, next) {
  try {
    const appointments = await appointmentService.listAppointments(
      request.user.id,
      request.user.role
    );
    return response.status(200).json({ appointments });
  } catch (error) {
    return sendError(response, error, next);
  }
}

async function getAppointmentById(request, response, next) {
  try {
    const appointment = await appointmentService.getAppointmentById(
      request.user.id,
      request.user.role,
      request.params.id
    );
    return response.status(200).json({ appointment });
  } catch (error) {
    return sendError(response, error, next);
  }
}

async function updateAppointment(request, response, next) {
  try {
    const appointment = await appointmentService.updateAppointment(
      request.user.id,
      request.user.role,
      request.params.id,
      request.body
    );
    return response.status(200).json({
      message: "Appointment updated successfully",
      appointment,
    });
  } catch (error) {
    return sendError(response, error, next);
  }
}

module.exports = {
  bookAppointment,
  listAppointments,
  getAppointmentById,
  updateAppointment,
};
