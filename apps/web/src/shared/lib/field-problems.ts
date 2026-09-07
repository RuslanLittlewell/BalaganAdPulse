import { t } from "@/shared/config/index.js";
import { ApiError } from "./http.js";

interface Issue {
  readonly path?: unknown;
  readonly code?: unknown;
  readonly origin?: unknown;
  readonly minimum?: unknown;
}

function fieldOf(issue: Issue): string | null {
  if (!Array.isArray(issue.path) || issue.path.length === 0) return null;
  return issue.path.map(String).join(".");
}

function complaintOf(issue: Issue): string {
  if (issue.code === "invalid_type") return t("validation.required");
  if (issue.code === "too_small" && issue.origin === "string" && Number(issue.minimum) <= 1) {
    return t("validation.required");
  }
  return t("validation.invalid");
}

export function fieldProblems(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};

  const problems: Record<string, string> = {};
  for (const issue of error.details) {
    if (typeof issue !== "object" || issue === null) continue;
    const field = fieldOf(issue as Issue);
    if (!field || field in problems) continue;
    problems[field] = complaintOf(issue as Issue);
  }
  return problems;
}
