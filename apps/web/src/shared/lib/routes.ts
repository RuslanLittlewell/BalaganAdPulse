import { sharedToken } from "./shareScope.js";

export const ROUTES = {
  dashboard: "/",
  projects: "/projects",
  tasks: "/tasks",
  crm: "/crm",
  reports: "/reports",
  archive: "/archive",
  organizations: "/organizations",
} as const;

export function sharePath(token: string, campaignId?: string): string {
  const base = `/share/${encodeURIComponent(token)}`;
  return campaignId ? `${base}/campaigns/${campaignId}` : base;
}

export function projectPath(clientId: string, campaignId?: string): string {
  const shared = sharedToken();
  if (shared !== null) return sharePath(shared, campaignId);
  const base = `${ROUTES.projects}/${clientId}`;
  return campaignId ? `${base}/campaigns/${campaignId}` : base;
}

export function projectDocumentsPath(projectId: string, documentId?: string): string {
  const base = `${projectPath(projectId)}/documents`;
  return documentId ? `${base}/${documentId}` : base;
}

export function reportPath(reportId: string): string {
  return `${ROUTES.reports}/${reportId}`;
}

export function moduleKeyFromPathname(pathname: string): string {
  const [segment] = pathname.split("/").filter(Boolean);
  return segment ?? "dashboard";
}
