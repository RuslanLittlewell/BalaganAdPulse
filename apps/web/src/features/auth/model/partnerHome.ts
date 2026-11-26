import type { ModuleKey } from "@adpulse/access-policy";
import { ROUTES } from "@/shared/lib/index.js";

export function partnerSeesProjects(modules: readonly ModuleKey[]): boolean {
  return !modules.includes("CRM");
}

export function partnerHome(modules: readonly ModuleKey[], partner: { projectId: string }): string {
  return partnerSeesProjects(modules) ? `${ROUTES.projects}/${partner.projectId}` : ROUTES.crm;
}
