import type { ModuleKey } from "@adpulse/access-policy";
import { http } from "@/shared/lib/index.js";
import type { Currency } from "@/shared/lib/index.js";

export interface Project {
  id: string;
  clientId: string;
  name: string;
  budgetCurrency: Currency;
  image: string | null;
  avatarPath: string | null;
  position: number;
  kpiTracked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  clientId?: string;
  name?: string;
  memberIds?: string[];
  kpiTracked?: boolean;
}

export interface SharedProject {
  project: Project;
  modules: ModuleKey[];
}

export interface ShareLink {
  token: string;
  createdAt: string;
}

const shareLinkPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/share-link`;

export const shareLinkApi = {
  read: (projectId: string, signal?: AbortSignal) => http.get<ShareLink | null>(shareLinkPath(projectId), { signal }),
  issue: (projectId: string, renew: boolean) => http.put<ShareLink>(shareLinkPath(projectId), { renew }),
  remove: (projectId: string) => http.del(shareLinkPath(projectId)),
};

export const sharedProjectApi = {
  open: (signal?: AbortSignal) => http.get<SharedProject>("", { signal }),
};

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
