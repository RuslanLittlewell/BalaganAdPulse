import { forceRefresh, hasSession } from "@/shared/lib/index.js";
import { NOTIFICATION_KINDS, NOTIFICATION_STREAM_PATH, type Notification } from "../api/api.js";

export const STREAM_BASE_DELAY_MS = 1_000;
export const STREAM_MAX_DELAY_MS = 15_000;

const CLOSED = 2;

export type EventSourceFactory = (url: string) => EventSource;

export interface NotificationStreamOptions {
  onNotification: (notification: Notification) => void;
  onReconnected: () => void;
  createSource?: EventSourceFactory;
}

export interface NotificationStream {
  close(): void;
}

function notificationOf(data: unknown): Notification | null {
  let payload: unknown;
  try {
    payload = JSON.parse(String(data));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;
  const { id, kind } = payload as { id?: unknown; kind?: unknown };
  return typeof id === "string" && (NOTIFICATION_KINDS as readonly unknown[]).includes(kind)
    ? (payload as Notification)
    : null;
}

const browserSource = (): EventSourceFactory | null =>
  typeof EventSource === "undefined" ? null : (url) => new EventSource(url, { withCredentials: true });

export function openNotificationStream(options: NotificationStreamOptions): NotificationStream {
  const create = options.createSource ?? browserSource();
  if (!create) return { close() {} };
  let stopped = false;
  let source: EventSource | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let readyBefore = false;

  const scheduleRetry = () => {
    if (stopped) return;
    const delay = Math.min(STREAM_BASE_DELAY_MS * 2 ** attempt, STREAM_MAX_DELAY_MS);
    attempt += 1;
    retry = setTimeout(() => {
      forceRefresh().then(connect, connect);
    }, delay);
  };

  const connect = () => {
    if (stopped || !hasSession()) return;
    const current = create(NOTIFICATION_STREAM_PATH);
    source = current;
    current.addEventListener("ready", () => {
      attempt = 0;
      if (readyBefore) options.onReconnected();
      readyBefore = true;
    });
    current.addEventListener("notification", (event) => {
      const notification = notificationOf((event as MessageEvent).data);
      if (notification) options.onNotification(notification);
    });
    current.onerror = () => {
      if (source !== current || current.readyState !== CLOSED) return;
      scheduleRetry();
    };
  };

  connect();

  return {
    close() {
      stopped = true;
      if (retry) clearTimeout(retry);
      source?.close();
      source = null;
    },
  };
}
