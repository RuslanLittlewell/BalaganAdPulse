import { http } from "@/shared/lib/index.js";
import type { Arrangement, ProjectGroup, ProjectLayout } from "../model/layout.js";

export const projectLayoutApi = {
  read: () => http.get<ProjectLayout>("/project-layout"),
  save: (body: Arrangement) => http.put<ProjectLayout>("/project-layout", body),
  createGroup: (name: string) => http.post<ProjectGroup>("/project-groups", { name }),
  removeGroup: (id: string) => http.del(`/project-groups/${id}`),
};
