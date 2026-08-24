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

/** A 5xx whose message was written to be read by the caller.
 *
 * `errorHandler` replaces the message of every unplanned 5xx with a fixed
 * string, because errors that were never meant for a stranger leak detail —
 * Prisma's carry absolute source paths. Backpressure is different: the caller
 * needs to be told to come back later, and `retryAfter` tells them when. */
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
