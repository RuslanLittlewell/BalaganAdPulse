import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskCommentsApi, type TaskCommentInput } from "./api.js";

export const taskCommentsKey = (taskId: string) => ["task-comments", taskId] as const;

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: taskCommentsKey(taskId),
    queryFn: () => taskCommentsApi.list(taskId),
  });
}

export function useTaskParticipants(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["task-participants", taskId] as const,
    queryFn: () => taskCommentsApi.participants(taskId),
    enabled,
  });
}

export function useAddTaskComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskCommentInput) => taskCommentsApi.add(taskId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskCommentsKey(taskId) }),
  });
}

export function useEditTaskComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: TaskCommentInput & { id: string }) => taskCommentsApi.edit(taskId, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskCommentsKey(taskId) }),
  });
}

export function useDeleteTaskComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskCommentsApi.remove(taskId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskCommentsKey(taskId) }),
  });
}
