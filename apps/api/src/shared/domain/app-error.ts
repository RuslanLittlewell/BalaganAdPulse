export type AppErrorCategory = "validation" | "unauthorized" | "forbidden" | "not-found" | "conflict";

export class AppError extends Error {
  constructor(
    readonly category: AppErrorCategory,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
