import { t } from "@/shared/config/index.js";

/** The order the menu offers them in: most attention first. */
export const PROJECT_PRIORITIES = [
  "CRITICAL",
  "URGENT",
  "WAITING",
  "IDLE",
  "NEW",
] as const;

export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

/** The colour each one is drawn in. A CSS variable rather than a literal, so
 * the two themes can differ without this file knowing about either. */
const COLOURS: Record<ProjectPriority, string> = {
  CRITICAL: "var(--priority-critical)",
  URGENT: "var(--priority-urgent)",
  WAITING: "var(--priority-waiting)",
  IDLE: "var(--priority-idle)",
  NEW: "var(--priority-new)",
};

export function priorityColour(priority: ProjectPriority): string {
  return COLOURS[priority];
}

export function priorityLabel(priority: ProjectPriority): string {
  return t(`priority.${priority}`);
}
