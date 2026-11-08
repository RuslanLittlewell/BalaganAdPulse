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
  if (typeof payload !== "object" || payload === null || Array.isArray(payload))
    return null;
  const { kind } = payload as { kind?: unknown };
  return typeof kind === "string" ? (payload as RealtimeMessage) : null;
}

const browserSocket = (url: string) => new WebSocket(url);

type Subscriber = { options: RealtimeChannelOptions; readyBefore: boolean };
interface SharedChannel {
  subscribers: Set<Subscriber>;
  ready: boolean;
  presence: Map<string, unknown> | null;
  start(): void;
  stop(): void;
}

const channels = new Map<(url: string) => WebSocket, SharedChannel>();

function createChannel(open: (url: string) => WebSocket): SharedChannel {
  let stopped = false;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const channel: SharedChannel = {
    subscribers: new Set(),
    ready: false,
    presence: null,
    start: () => connect(),
    stop() {
      stopped = true;
      if (retry) clearTimeout(retry);
      const closing = socket;
      socket = null;
      closing?.close();
    },
  };

  const connect = () => {
    if (stopped) return;
    retry = null;
    const client = open(realtimeUrl());
    socket = client;
    client.onmessage = (event: MessageEvent) => {
      if (stopped || socket !== client) return;
      const message = messageOf(event.data);
      if (!message) return;
      if (message.kind === "ready") {
        attempt = 0;
        channel.ready = true;
        for (const subscriber of channel.subscribers) {
          subscriber.options.onReady?.(subscriber.readyBefore);
          subscriber.readyBefore = true;
        }
        return;
      }
      if (message.kind === "presence.state" && Array.isArray(message.people)) {
        channel.presence = new Map(message.people.map((person) => [person.userId, person]));
      } else if (message.kind === "presence.joined" && message.person && typeof message.person === "object") {
        const person = message.person as { userId: string };
        channel.presence?.set(person.userId, person);
      } else if (message.kind === "presence.left" && typeof message.userId === "string") {
        channel.presence?.delete(message.userId);
      }
      for (const subscriber of channel.subscribers) subscriber.options.onMessage?.(message);
    };
    client.onclose = () => {
      if (stopped || socket !== client) return;
      socket = null;
      channel.ready = false;
      const delay = Math.min(REALTIME_BASE_DELAY_MS * 2 ** attempt, REALTIME_MAX_DELAY_MS);
      attempt += 1;
      retry = setTimeout(connect, delay);
    };
    client.onerror = () => { client.close(); };
  };

  return channel;
}

export function openRealtimeChannel(options: RealtimeChannelOptions = {}): RealtimeChannel {
  const open = options.createSocket ?? browserSocket;
  let channel = channels.get(open);
  const start = !channel;
  if (!channel) {
    channel = createChannel(open);
    channels.set(open, channel);
  }
  const shared = channel;
  const subscriber: Subscriber = { options, readyBefore: shared.ready };
  shared.subscribers.add(subscriber);
  if (shared.ready) options.onReady?.(false);
  if (shared.presence) options.onMessage?.({ kind: "presence.state", people: [...shared.presence.values()] });
  if (start) shared.start();

  return {
    close() {
      shared.subscribers.delete(subscriber);
      if (shared.subscribers.size > 0 || channels.get(open) !== shared) return;
      channels.delete(open);
      shared.stop();
    },
  };
}
