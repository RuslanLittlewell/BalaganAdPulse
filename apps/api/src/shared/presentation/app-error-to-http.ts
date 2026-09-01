import type { AppError, AppErrorCategory } from "../domain/app-error.js";

const statusByCategory: Readonly<Record<AppErrorCategory, number>> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  "not-found": 404,
  conflict: 409,
};

export function appErrorToHttp(error: AppError) {
  const body: { error: { message: string; details?: unknown } } = { error: { message: error.message } };
  if (error.details !== undefined) body.error.details = error.details;
  return { status: statusByCategory[error.category], body };
}
