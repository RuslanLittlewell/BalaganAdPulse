export const REALTIME_PATH = "/api/realtime";

export const REALTIME_BASE_DELAY_MS = 1_000;
export const REALTIME_MAX_DELAY_MS = 15_000;

export interface RealtimeMessage {
  readonly kind: string;
  readonly [field: string]: unknown;
}

export interface RealtimeChannelOptions {
  onMessage?: (message: RealtimeMessage) => void;
  onReady?: (reconnected: boolean) => void;
  createSocket?: (url: string) => WebSocket;
}

export interface RealtimeChannel {
  close(): void;
}

export function realtimeUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${REALTIME_PATH}`;
}

function messageOf(data: unknown): RealtimeMessage | null {
  let payload: unknown;
  try {
    payload = JSON.parse(String(data));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const { kind } = payload as { kind?: unknown };
  return typeof kind === "string" ? (payload as RealtimeMessage) : null;
}

export function openRealtimeChannel(options: RealtimeChannelOptions = {}): RealtimeChannel {
  const open = options.createSocket ?? ((url: string) => new WebSocket(url));
  let stopped = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let connectedBefore = false;

  const scheduleRetry = () => {
    if (stopped) return;
    const delay = Math.min(REALTIME_BASE_DELAY_MS * 2 ** attempt, REALTIME_MAX_DELAY_MS);
    attempt += 1;
    retry = setTimeout(() => { connect(); }, delay);
  };

  const connect = () => {
    if (stopped) return;
    const client = open(realtimeUrl());
    socket = client;

    client.onmessage = (event: MessageEvent) => {
      const message = messageOf(event.data);
      if (!message) return;
      if (message.kind === "ready") {
        attempt = 0;
        options.onReady?.(connectedBefore);
        connectedBefore = true;
        return;
      }
      options.onMessage?.(message);
    };

    client.onclose = () => { if (socket === client) scheduleRetry(); };
    client.onerror = () => { client.close(); };
  };

  connect();

  return {
    close() {
      stopped = true;
      if (retry) clearTimeout(retry);
      const closing = socket;
      socket = null;
      closing?.close();
    },
  };
}
