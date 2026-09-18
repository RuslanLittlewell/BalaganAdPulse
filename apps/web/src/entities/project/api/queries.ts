import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type ProjectInput } from "./api.js";
import { refreshProjects } from "../model/projects.js";

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
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
