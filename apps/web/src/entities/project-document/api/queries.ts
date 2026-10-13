import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  projectDocumentsApi,
  type DocumentChange,
  type DocumentSummary,
  type ProjectDocument,
} from "./api.js";

export const projectDocumentsKey = (projectId: string) => ["project-documents", projectId] as const;
export const projectDocumentKey = (projectId: string, id: string) => ["project-documents", projectId, id] as const;

const summaryOf = ({ content: _content, createdBy: _createdBy, ...summary }: ProjectDocument): DocumentSummary => summary;

export function useProjectDocuments(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectDocumentsKey(projectId),
    queryFn: () => projectDocumentsApi.list(projectId),
    enabled,
  });
}

export function useProjectDocument(projectId: string, id: string | undefined) {
  return useQuery({
    queryKey: projectDocumentKey(projectId, id ?? ""),
    queryFn: () => projectDocumentsApi.read(projectId, id!),
    enabled: id !== undefined,
    retry: false,
  });
}

export function useCreateProjectDocument(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => projectDocumentsApi.create(projectId, title),
    onSuccess: (created) => {
      qc.setQueryData(projectDocumentKey(projectId, created.id), created);
      qc.setQueryData<DocumentSummary[]>(projectDocumentsKey(projectId), (list) => [...(list ?? []), summaryOf(created)]);
    },
  });
}

export function useSaveProjectDocument(projectId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    scope: { id: `project-document:${id}` },
    mutationFn: (change: DocumentChange) => projectDocumentsApi.update(projectId, id, change),
    onSuccess: (saved) => {
      qc.setQueryData(projectDocumentKey(projectId, saved.id), saved);
      qc.setQueryData<DocumentSummary[]>(projectDocumentsKey(projectId), (list) =>
        list?.map((entry) => (entry.id === saved.id ? summaryOf(saved) : entry)));
    },
  });
}

export function useDeleteProjectDocument(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectDocumentsApi.remove(projectId, id),
    onSuccess: (_result, id) => {
      qc.removeQueries({ queryKey: projectDocumentKey(projectId, id) });
      qc.setQueryData<DocumentSummary[]>(projectDocumentsKey(projectId), (list) => list?.filter((entry) => entry.id !== id));
    },
  });
}
