import { projectPath, ROUTES } from "@/shared/lib/index.js";
import type { OnboardingStepKey } from "../api.js";

export const CONTACTS_PARAM = "contacts";
export const PROFILE_PARAM = "profile";

export type StepLink = { pathname?: string; search?: string };

export function stepLink(step: OnboardingStepKey, firstProjectId: string | null): StepLink {
  switch (step) {
    case "client": return { search: `?${CONTACTS_PARAM}=clients` };
    case "team": return { search: `?${CONTACTS_PARAM}=employees` };
    case "project": return { pathname: ROUTES.projects };
    case "adAccount": return { pathname: firstProjectId ? projectPath(firstProjectId) : ROUTES.projects };
    case "kpi": return { pathname: ROUTES.dashboard };
    case "telegram": return { pathname: ROUTES.tasks };
    case "profile": return { search: `?${PROFILE_PARAM}=open` };
  }
}
