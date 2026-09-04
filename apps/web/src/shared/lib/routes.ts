export const ROUTES = {
  dashboard: "/",
  projects: "/projects",
  tasks: "/tasks",
  reports: "/reports",
  archive: "/archive",
} as const;

export function projectPath(clientId: string, campaignId?: string): string {
  const base = `${ROUTES.projects}/${clientId}`;
  return campaignId ? `${base}/campaigns/${campaignId}` : base;
}
