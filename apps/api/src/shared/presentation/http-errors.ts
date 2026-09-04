export class NotFoundError extends Error {
  status = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  status = 400;
  constructor(message = "Validation error") {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  status = 409;
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ServiceUnavailableError extends Error {
  status = 503;
  expose = true;
  retryAfter?: number;

  constructor(message = "Service unavailable", retryAfter?: number) {
    super(message);
    this.name = "ServiceUnavailableError";
    this.retryAfter = retryAfter;
  }
}
