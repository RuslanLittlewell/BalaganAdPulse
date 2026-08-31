import { http } from "@/shared/lib/index.js";
import type { ProjectPriority } from "../model/priority.js";

export interface Project {
  id: string;
  clientId: string;
  name: string;
  niche: string | null;
  /** A decimal string, so a budget never loses precision on the way here. */
  monthlyBudget: string | null;
  /** How much attention it needs. A new project starts at "NEW". */
  priority: ProjectPriority;
  /** The logo itself, as a `data:` URL — or null when none is set. */
  image: string | null;
  avatarPath: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  clientId?: string;
  name?: string;
  niche?: string | null;
  monthlyBudget?: number | null;
  priority?: ProjectPriority;
}

export const projectsApi = {
  list: (clientId?: string) =>
    http.get<Project[]>(clientId ? `/projects?clientId=${clientId}` : "/projects"),
  get: (id: string) => http.get<Project>(`/projects/${id}`),
  create: (body: ProjectInput) => http.post<Project>("/projects", body),
  update: (id: string, body: ProjectInput) => http.patch<Project>(`/projects/${id}`, body),
  remove: (id: string) => http.del(`/projects/${id}`),
  saveAvatar: (id: string, png: Blob, avatarPath: string) => {
    const form = new FormData();
    form.append("image", png, "avatar.png");
    form.append("avatarPath", avatarPath);
    return http.putForm<Project>(`/projects/${id}/avatar`, form);
  },
};
