import { renderHook, act } from "@testing-library/react";
import { hookWrapper } from "@test/shared/index.js";
import { CRM_EVENTS_BASE_DELAY_MS, leadColumnsKey, leadsKey, useCrmEvents } from "@/entities/lead/index.js";

import { CRM_REFRESH_WINDOW_MS } from "@/entities/lead/api/useCrmEvents.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

class FakeSocket {
  static opened: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) { FakeSocket.opened.push(this); }
  send() {}
  close() { this.closed = true; }

  deliver(payload: unknown) {
    act(() => { this.onmessage?.({ data: JSON.stringify(payload) }); });
  }
  ready() { this.deliver({ kind: "ready" }); }
  drop() { act(() => { this.onclose?.(); }); }
}

function setup(boardKey: string | undefined) {
  FakeSocket.opened = [];
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(leadsKey("project-1"), []);
  wrapper.client.setQueryData(leadsKey("client-1"), []);
  const invalidate = vi.spyOn(wrapper.client, "invalidateQueries");
  const createSocket = vi.fn((url: string) => new FakeSocket(url) as never);
  const rendered = renderHook(() => useCrmEvents(boardKey, { createSocket }), { wrapper });
  return { wrapper, invalidate, rendered, socket: () => FakeSocket.opened.at(-1)! };
}

const changed = (board: string) => ({ kind: "crm.changed", orgId: "org1", board });

describe("useCrmEvents", () => {
  it("waits for an ongoing read and then refreshes once so events during the read are retained", async () => {
    const { wrapper, invalidate, socket } = setup("project-1");
    let finish: ((value: unknown[]) => void) | undefined;
    const reading = wrapper.client.fetchQuery({
      queryKey: leadsKey("project-1"),
      queryFn: () => new Promise<unknown[]>((resolve) => { finish = resolve; }),
    });
    socket().deliver({ ...changed("project-1"), resources: ["leads"] });
    await act(async () => { await vi.advanceTimersByTimeAsync(CRM_REFRESH_WINDOW_MS); });
    expect(invalidate).not.toHaveBeenCalled();
    await act(async () => { finish?.([]); await reading; });
    await act(async () => { await vi.advanceTimersByTimeAsync(CRM_REFRESH_WINDOW_MS); });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: leadsKey("project-1") }, { cancelRefetch: false });
  });

  it("coalesces a burst and refreshes only the affected lead's files and activity", () => {
    const { invalidate, socket } = setup("project-1");
    socket().ready();
    invalidate.mockClear();
    for (let i = 0; i < 10; i++) socket().deliver({
      ...changed("project-1"), resources: ["files", "activity"], leadId: "l1",
    });
    expect(invalidate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CRM_REFRESH_WINDOW_MS));
    expect(invalidate.mock.calls).toEqual([
      [{ queryKey: ["crm", "lead-files", "project-1", "l1"] }, { cancelRefetch: false }],
      [{ queryKey: ["crm", "lead-activity", "project-1", "l1"] }, { cancelRefetch: false }],
    ]);
  });

  it("cancels a scheduled refresh when leaving the board", () => {
    const { invalidate, socket, rendered } = setup("project-1");
    socket().deliver(changed("project-1"));
    rendered.unmount();
    act(() => vi.advanceTimersByTime(CRM_REFRESH_WINDOW_MS));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("refetches the open board when it is told the board changed", () => {
    const { invalidate, socket } = setup("project-1");
    socket().ready();
    invalidate.mockClear();

    socket().deliver(changed("project-1"));
    act(() => vi.advanceTimersByTime(CRM_REFRESH_WINDOW_MS));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: leadsKey("project-1") }, { cancelRefetch: false });
  });

  it("refetches the columns of the open board too, so a column another member added appears", () => {
    const { invalidate, socket } = setup("project-1");
    socket().ready();
    invalidate.mockClear();

    socket().deliver(changed("project-1"));
    act(() => vi.advanceTimersByTime(CRM_REFRESH_WINDOW_MS));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: leadColumnsKey("project-1") }, { cancelRefetch: false });
  });

  it("ignores a change on a board the member is not looking at", () => {
    const { invalidate, socket } = setup("project-1");
    socket().ready();
    invalidate.mockClear();

    socket().deliver(changed("client-1"));

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("leaves task events to the task board", () => {
    const { invalidate, socket } = setup("project-1");
    socket().ready();
    invalidate.mockClear();

    socket().deliver({ kind: "task.moved", orgId: "org1", projectId: "p1", task: { id: "t1" } });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("refetches after a dropped connection comes back", async () => {
    vi.useFakeTimers();
    const { invalidate, socket } = setup("project-1");
    socket().ready();
    invalidate.mockClear();

    socket().drop();
    await act(async () => { await vi.advanceTimersByTimeAsync(CRM_EVENTS_BASE_DELAY_MS); });
    expect(FakeSocket.opened).toHaveLength(2);

    socket().ready();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: leadsKey("project-1") }, { cancelRefetch: false });
    vi.useRealTimers();
  });

  it("opens no connection at all while no board is chosen", () => {
    const { rendered } = setup(undefined);
    expect(FakeSocket.opened).toHaveLength(0);
    rendered.unmount();
  });

  it("closes the connection when the board is left", () => {
    const { rendered, socket } = setup("project-1");
    const opened = socket();
    rendered.unmount();
    expect(opened.closed).toBe(true);
  });
});
