import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type ProjectInput } from "./api.js";

const PROJECTS_KEY = ["projects"] as const;

export function useProjects(clientId?: string) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, clientId ?? null],
    queryFn: () => projectsApi.list(clientId),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectInput) => projectsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProjectInput }) =>
      projectsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useSaveProjectAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, png, avatarPath }: { id: string; png: Blob; avatarPath: string }) =>
      projectsApi.saveAvatar(id, png, avatarPath),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
