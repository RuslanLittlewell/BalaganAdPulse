/** The application's top-level modules. One place, so a renamed path cannot be
 * half-renamed across the navigation, the pages and the redirects. */
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
