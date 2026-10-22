import { matchPath } from "react-router-dom";
import { ROUTES } from "@/shared/lib/index.js";

export function previewedProjectId(pathname: string): string | null {
  return matchPath(`${ROUTES.projects}/:projectId/*`, pathname)?.params.projectId ?? null;
}
