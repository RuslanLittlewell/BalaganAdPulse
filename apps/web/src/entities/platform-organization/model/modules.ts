import type { ModuleKey } from "@adpulse/access-policy";
import { t, type MessageKey } from "@/shared/config/index.js";

const MODULE_LABELS: Readonly<Record<ModuleKey, MessageKey>> = {
  DASHBOARD: "nav.dashboard",
  PROJECTS: "nav.projects",
  CRM: "nav.crm",
  TASKS: "nav.tasks",
  REPORTS: "nav.reports",
};

export function moduleLabel(module: ModuleKey): string {
  return t(MODULE_LABELS[module]);
}
