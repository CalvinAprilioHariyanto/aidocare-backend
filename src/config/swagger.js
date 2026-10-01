const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Aido Care API",
      version: "1.0.0",
      description: "Authentication and access control API for the Aido Care backend.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
        UserPublic: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["PATIENT", "DOCTOR"] },
          },
          required: ["id", "email", "role"],
        },
        RegisterRequest: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phoneNumber: { type: "string" },
            password: { type: "string", format: "password" },
            confirmPassword: { type: "string", format: "password" },
          },
          required: ["firstName", "lastName", "email", "phoneNumber", "password", "confirmPassword"],
        },
        LoginRequest: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", format: "password" },
          },
          required: ["email", "password"],
        },
        RegistrationSuccess: {
          type: "object",
          properties: {
            message: { type: "string" },
            user: { $ref: "#/components/schemas/UserPublic" },
          },
          required: ["message", "user"],
        },
        AccessTokenResponse: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            user: { $ref: "#/components/schemas/UserPublic" },
          },
          required: ["accessToken", "refreshToken", "user"],
        },
      },
    },
  },
  apis: [path.resolve(__dirname, "../routes/authRoutes.js")],
};

module.exports = swaggerJsdoc(options);
