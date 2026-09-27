import type { FastifyError, FastifyInstance } from "fastify";
import { AppError } from "./errors.js";

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

const CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  405: "METHOD_NOT_ALLOWED",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  429: "TOO_MANY_REQUESTS",
};

// IT'S JOB IS TO CONFIGURE FASTIFY'S ERROR HANDLING
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      const status = STATUS_BY_CODE[error.code] ?? 500;

      request.log.warn({ err: error, code: error.code }, "application error");

      return reply.code(status).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }

    const fastifyError = error as FastifyError;
    const status =
      typeof fastifyError.statusCode === "number" ? fastifyError.statusCode : 500;

    if (status >= 400 && status < 500) {
      request.log.warn({ err: fastifyError, status }, "client error");

      return reply.code(status).send({
        error: {
          code: CODE_BY_STATUS[status] ?? "BAD_REQUEST",
          message: fastifyError.message,
          requestId: request.id,
        },
      });
    }

    request.log.error({ err: fastifyError }, "unhandled error");

    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "an unexpected error occurred",
        requestId: request.id,
      },
    });
  });
}
