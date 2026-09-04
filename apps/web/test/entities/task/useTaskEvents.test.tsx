import { renderHook, act, waitFor } from "@testing-library/react";
import { hookWrapper } from "@test/shared/index.js";
import { useTaskEvents, TASK_EVENTS_BASE_DELAY_MS, TASK_EVENTS_MAX_DELAY_MS } from "@/entities/task/index.js";
import type { Task } from "@/entities/task/index.js";

const task = (id: string, column: Task["column"], position: number): Task => ({
  id, projectId: "p1", orgId: "org1", title: id, description: null,
  column, priority: "LOW", assigneeId: null, createdById: null, campaignId: null, visibleToClient: false, position, imageIds: [],
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
});

class FakeSocket {
  static opened: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(readonly url: string) { FakeSocket.opened.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; }

  accept() { act(() => { this.onopen?.(); }); }
  deliver(payload: unknown) {
    act(() => { this.onmessage?.({ data: JSON.stringify(payload) }); });
  }
  ready() { this.deliver({ kind: "ready" }); }
  drop() { act(() => { this.onclose?.(); }); }
}

const board = [task("a", "IDEA", 0), task("b", "IDEA", 1), task("x", "DONE", 0)];

function setup() {
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(["tasks", null], board);
  const createSocket = vi.fn((url: string) => new FakeSocket(url) as never);
  const rendered = renderHook(() => useTaskEvents({ createSocket }), { wrapper });
  return { wrapper, createSocket, rendered };
}

const read = (wrapper: ReturnType<typeof hookWrapper>) =>
  wrapper.client.getQueryData<Task[]>(["tasks", null]) ?? [];

const latest = () => FakeSocket.opened[FakeSocket.opened.length - 1]!;

beforeEach(() => { FakeSocket.opened = []; });
afterEach(() => { vi.useRealTimers(); });

describe("subscribing to the board", () => {
  it("opens one socket and sends nothing to authenticate", async () => {
    setup();
    await waitFor(() => expect(FakeSocket.opened).toHaveLength(1));

    latest().accept();

    expect(latest().sent).toEqual([]);
    expect(latest().url).toContain("/api/realtime");
    expect(latest().url).not.toContain("token");
  });

  it("applies a move another member made", async () => {
    const { wrapper } = setup();
    await waitFor(() => expect(FakeSocket.opened).toHaveLength(1));
    latest().accept();
    latest().ready();

    latest().deliver({
      kind: "task.moved", orgId: "org1", projectId: "p1",
      task: task("a", "DONE", 0),
    });

    expect(read(wrapper).find((t) => t.id === "a")).toMatchObject({ column: "DONE", position: 0 });
  });

  it("removes a task another member deleted", async () => {
    const { wrapper } = setup();
    await waitFor(() => expect(FakeSocket.opened).toHaveLength(1));
    latest().accept();
    latest().ready();

    latest().deliver({ kind: "task.deleted", orgId: "org1", projectId: "p1", taskId: "a" });

    expect(read(wrapper).map((t) => t.id)).toEqual(["b", "x"]);
  });

  it("ignores a message it cannot parse", async () => {
    const { wrapper } = setup();
    await waitFor(() => expect(FakeSocket.opened).toHaveLength(1));
    latest().accept();

    act(() => { latest().onmessage?.({ data: "not json" }); });

    expect(read(wrapper)).toEqual(board);
  });

  it("closes the socket when the board unmounts", async () => {
    const { rendered } = setup();
    await waitFor(() => expect(FakeSocket.opened).toHaveLength(1));
    const socket = latest();

    rendered.unmount();

    expect(socket.closed).toBe(true);
  });
});

describe("recovering a dropped connection", () => {
  it("reconnects after a drop", async () => {
    vi.useFakeTimers();
    setup();
    await vi.waitFor(() => expect(FakeSocket.opened).toHaveLength(1));
    latest().accept();
    latest().ready();

    latest().drop();
    await act(async () => { await vi.advanceTimersByTimeAsync(TASK_EVENTS_BASE_DELAY_MS); });

    expect(FakeSocket.opened).toHaveLength(2);
  });

  it("refetches the board once on reconnecting, but not on the first connect", async () => {
    vi.useFakeTimers();
    const { wrapper } = setup();
    const invalidate = vi.spyOn(wrapper.client, "invalidateQueries");
    await vi.waitFor(() => expect(FakeSocket.opened).toHaveLength(1));

    latest().accept();
    latest().ready();
    expect(invalidate).not.toHaveBeenCalled();

    latest().drop();
    await act(async () => { await vi.advanceTimersByTimeAsync(TASK_EVENTS_BASE_DELAY_MS); });
    latest().accept();
    latest().ready();

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("waits longer after each failure, up to a bound", async () => {
    vi.useFakeTimers();
    setup();
    await vi.waitFor(() => expect(FakeSocket.opened).toHaveLength(1));

    const delays: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const before = FakeSocket.opened.length;
      latest().drop();
      let waited = 0;
      while (FakeSocket.opened.length === before && waited <= TASK_EVENTS_MAX_DELAY_MS) {
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        waited += 100;
      }
      delays.push(waited);
    }

    expect(delays[0]).toBeLessThan(delays[3]!);
    expect(Math.max(...delays)).toBeLessThanOrEqual(TASK_EVENTS_MAX_DELAY_MS);
    latest().accept();
    latest().ready();
    const before = FakeSocket.opened.length;
    latest().drop();
    await act(async () => { await vi.advanceTimersByTimeAsync(TASK_EVENTS_BASE_DELAY_MS); });
    expect(FakeSocket.opened.length).toBe(before + 1);
  });

  it("does not reconnect after unmounting", async () => {
    vi.useFakeTimers();
    const { rendered } = setup();
    await vi.waitFor(() => expect(FakeSocket.opened).toHaveLength(1));

    rendered.unmount();
    latest().drop();
    await act(async () => { await vi.advanceTimersByTimeAsync(TASK_EVENTS_MAX_DELAY_MS * 2); });

    expect(FakeSocket.opened).toHaveLength(1);
  });
});
