import { renderHook, act } from "@testing-library/react";
import { hookWrapper } from "@test/shared/index.js";
import { CRM_EVENTS_BASE_DELAY_MS, leadsKey, useCrmEvents } from "@/entities/lead/index.js";

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
  wrapper.client.setQueryData(leadsKey("agency"), []);
  wrapper.client.setQueryData(leadsKey("client-1"), []);
  const invalidate = vi.spyOn(wrapper.client, "invalidateQueries");
  const createSocket = vi.fn((url: string) => new FakeSocket(url) as never);
  const rendered = renderHook(() => useCrmEvents(boardKey, { createSocket }), { wrapper });
  return { wrapper, invalidate, rendered, socket: () => FakeSocket.opened.at(-1)! };
}

const changed = (board: string) => ({ kind: "crm.changed", orgId: "org1", board });

describe("useCrmEvents", () => {
  it("refetches the open board when it is told the board changed", () => {
    const { invalidate, socket } = setup("agency");
    socket().ready();
    invalidate.mockClear();

    socket().deliver(changed("agency"));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: leadsKey("agency") });
  });

  it("ignores a change on a board the member is not looking at", () => {
    const { invalidate, socket } = setup("agency");
    socket().ready();
    invalidate.mockClear();

    socket().deliver(changed("client-1"));

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("leaves task events to the task board", () => {
    const { invalidate, socket } = setup("agency");
    socket().ready();
    invalidate.mockClear();

    socket().deliver({ kind: "task.moved", orgId: "org1", projectId: "p1", task: { id: "t1" } });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("refetches after a dropped connection comes back", async () => {
    vi.useFakeTimers();
    const { invalidate, socket } = setup("agency");
    socket().ready();
    invalidate.mockClear();

    socket().drop();
    await act(async () => { await vi.advanceTimersByTimeAsync(CRM_EVENTS_BASE_DELAY_MS); });
    expect(FakeSocket.opened).toHaveLength(2);

    socket().ready();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: leadsKey("agency") });
    vi.useRealTimers();
  });

  it("opens no connection at all while no board is chosen", () => {
    const { rendered } = setup(undefined);
    expect(FakeSocket.opened).toHaveLength(0);
    rendered.unmount();
  });

  it("closes the connection when the board is left", () => {
    const { rendered, socket } = setup("agency");
    const opened = socket();
    rendered.unmount();
    expect(opened.closed).toBe(true);
  });
});
