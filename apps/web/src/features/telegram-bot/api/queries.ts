import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { telegramApi } from "./api.js";

export const TELEGRAM_KEY = ["telegram-bot"] as const;
export const LINK_WATCH_MS = 3000;

export function useTelegramStatus(waitingForLink: boolean) {
  return useQuery({
    queryKey: TELEGRAM_KEY,
    queryFn: telegramApi.status,
    refetchInterval: (query) => waitingForLink && !query.state.data?.linked ? LINK_WATCH_MS : false,
    refetchOnWindowFocus: waitingForLink,
  });
}

export function useTelegramLink() {
  return useMutation({ mutationFn: telegramApi.link });
}

export function useTelegramUnlink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: telegramApi.unlink,
    onSuccess: () => qc.invalidateQueries({ queryKey: TELEGRAM_KEY }),
  });
}
