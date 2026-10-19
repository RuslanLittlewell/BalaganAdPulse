import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type NotificationList } from "./api.js";
import { withAllRead, withOneRead } from "../model/list.js";

export const NOTIFICATIONS_KEY = ["notifications"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: notificationsApi.list,
  });
}

export function useReadNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.read(id),
    onMutate: (id) => {
      qc.setQueryData<NotificationList>(NOTIFICATIONS_KEY, (list) =>
        list && withOneRead(list, id, new Date().toISOString()));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useReadAllNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onMutate: () => {
      qc.setQueryData<NotificationList>(NOTIFICATIONS_KEY, (list) =>
        list && withAllRead(list, new Date().toISOString()));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
