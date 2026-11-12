import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi, shareLinkApi, sharedProjectApi, type ProjectInput } from "./api.js";
import { refreshProjects } from "../model/projects.js";

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    meta: { affectsOnboarding: true },
    mutationFn: (body: ProjectInput) => projectsApi.create(body),
    onSuccess: () => refreshProjects(),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProjectInput }) =>
      projectsApi.update(id, body),
    onSuccess: () => refreshProjects(),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    meta: { affectsOnboarding: true },
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => refreshProjects(),
  });
}

export function useSaveProjectAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, png, avatarPath }: { id: string; png: Blob; avatarPath: string }) =>
      projectsApi.saveAvatar(id, png, avatarPath),
    onSuccess: () => refreshProjects(),
  });
}

export function useSharedProject() {
  return useQuery({
    queryKey: ["shared-project"],
    queryFn: ({ signal }) => sharedProjectApi.open(signal),
    retry: false,
  });
}

export const shareLinkKey = (projectId: string) => ["share-link", projectId] as const;

export function useShareLink(projectId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: shareLinkKey(projectId),
    queryFn: ({ signal }) => shareLinkApi.read(projectId, signal),
    enabled,
  });
}

export function useIssueShareLink(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (renew: boolean) => shareLinkApi.issue(projectId, renew),
    onSuccess: (link) => qc.setQueryData(shareLinkKey(projectId), link),
  });
}

export function useRemoveShareLink(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => shareLinkApi.remove(projectId),
    onSuccess: () => qc.setQueryData(shareLinkKey(projectId), null),
  });
}
