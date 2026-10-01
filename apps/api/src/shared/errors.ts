export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found`, "NOT_FOUND", { resource, identifier });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_FAILED", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, "FORBIDDEN");
  }
}

const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  while (current instanceof Error) {
    if ("code" in current && current.code === PG_UNIQUE_VIOLATION) {
      return true;
    }
    current = current.cause;
  }

  return false;
}
