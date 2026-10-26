import { http } from "@/shared/lib/index.js";

export interface TelegramStatus {
  available: boolean;
  linked: boolean;
  username: string | null;
  linkedAt: string | null;
  notifications: boolean;
}

export interface TelegramLink {
  url: string;
  expiresAt: string;
}

export const telegramApi = {
  status: () => http.get<TelegramStatus>("/telegram"),
  link: () => http.post<TelegramLink>("/telegram/link", {}),
  unlink: () => http.del("/telegram/link"),
  notify: (notifications: boolean) => http.patch<TelegramStatus>("/telegram", { notifications }),
};
