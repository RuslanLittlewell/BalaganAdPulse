import { openRealtimeChannel, REALTIME_BASE_DELAY_MS, REALTIME_MAX_DELAY_MS } from "@/shared/lib/index.js";

class FakeSocket {
  static opened: FakeSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) { FakeSocket.opened.push(this); }
  close() { this.closed = true; }
  deliver(data: string) { this.onmessage?.({ data }); }
  send(payload: unknown) { this.deliver(JSON.stringify(payload)); }
  drop() { this.onclose?.(); }
}

const latest = () => FakeSocket.opened[FakeSocket.opened.length - 1]!;

const createSocket = (url: string) => new FakeSocket(url) as unknown as WebSocket;

beforeEach(() => { FakeSocket.opened = []; });
afterEach(() => { vi.useRealTimers(); });

describe("the realtime channel", () => {
  it("opens one connection to the realtime path", () => {
    const channel = openRealtimeChannel({ createSocket });

    expect(FakeSocket.opened).toHaveLength(1);
    expect(latest().url).toContain("/api/realtime");
    channel.close();
  });

  it("hands over every message it is sent", () => {
    const messages: unknown[] = [];
    const channel = openRealtimeChannel({ createSocket, onMessage: (m) => messages.push(m) });

    latest().send({ kind: "presence.left", userId: "u2" });

    expect(messages).toEqual([{ kind: "presence.left", userId: "u2" }]);
    channel.close();
  });

  it("ignores anything that is not a message it can read", () => {
    const messages: unknown[] = [];
    const channel = openRealtimeChannel({ createSocket, onMessage: (m) => messages.push(m) });

    latest().deliver("not json");
    latest().deliver(JSON.stringify(["a list"]));

    expect(messages).toEqual([]);
    channel.close();
  });

  it("says when the connection is ready, and whether it had been up before", () => {
    vi.useFakeTimers();
    const ready: boolean[] = [];
    const channel = openRealtimeChannel({ createSocket, onReady: (again) => ready.push(again) });

    latest().send({ kind: "ready" });
    latest().drop();
    vi.advanceTimersByTime(REALTIME_BASE_DELAY_MS);
    latest().send({ kind: "ready" });

    expect(ready).toEqual([false, true]);
    channel.close();
  });

  it("reopens after a drop, waiting longer each time up to a bound", () => {
    vi.useFakeTimers();
    const channel = openRealtimeChannel({ createSocket });

    latest().drop();
    vi.advanceTimersByTime(REALTIME_BASE_DELAY_MS - 1);
    expect(FakeSocket.opened).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.opened).toHaveLength(2);

    latest().drop();
    vi.advanceTimersByTime(REALTIME_BASE_DELAY_MS * 2);
    expect(FakeSocket.opened).toHaveLength(3);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      latest().drop();
      vi.advanceTimersByTime(REALTIME_MAX_DELAY_MS);
    }
    expect(FakeSocket.opened).toHaveLength(13);
    channel.close();
  });

  it("stays closed once it is closed", () => {
    vi.useFakeTimers();
    const channel = openRealtimeChannel({ createSocket });

    channel.close();
    latest().drop();
    vi.advanceTimersByTime(REALTIME_MAX_DELAY_MS * 2);

    expect(FakeSocket.opened).toHaveLength(1);
    expect(FakeSocket.opened[0]!.closed).toBe(true);
  });
});
