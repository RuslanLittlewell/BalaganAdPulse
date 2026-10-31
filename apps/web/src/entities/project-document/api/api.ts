import { http } from "@/shared/lib/index.js";

export interface DocumentAuthor {
  id: string;
  name: string;
}

export interface DocumentSummary {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: DocumentAuthor | null;
  excerpt: string;
}

export interface ProjectDocument extends DocumentSummary {
  content: unknown | null;
  createdBy: DocumentAuthor | null;
}

export interface DocumentChange {
  title?: string;
  content?: unknown | null;
}

const documentsOf = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/documents`;
const documentAt = (projectId: string, id: string) => `${documentsOf(projectId)}/${encodeURIComponent(id)}`;

export const projectDocumentsApi = {
  list: (projectId: string) => http.get<DocumentSummary[]>(documentsOf(projectId)),
  read: (projectId: string, id: string) => http.get<ProjectDocument>(documentAt(projectId, id)),
  create: (projectId: string, title: string) => http.post<ProjectDocument>(documentsOf(projectId), { title }),
  update: (projectId: string, id: string, change: DocumentChange) =>
    http.patch<ProjectDocument>(documentAt(projectId, id), change),
  remove: (projectId: string, id: string) => http.del(documentAt(projectId, id)),
};
