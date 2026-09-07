import { renderHook, act } from "@testing-library/react";
import { usePresence } from "@/entities/presence/index.js";

class FakeSocket {
  static opened: FakeSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) { FakeSocket.opened.push(this); }
  close() { this.closed = true; }
  deliver(payload: unknown) {
    act(() => { this.onmessage?.({ data: JSON.stringify(payload) }); });
  }
}

const latest = () => FakeSocket.opened[FakeSocket.opened.length - 1]!;
const createSocket = (url: string) => new FakeSocket(url) as unknown as WebSocket;

const mary = { userId: "u2", membershipId: "m2", name: "Мария", image: null };
const peter = { userId: "u3", membershipId: "m3", name: "Пётр", image: "2026-09-01" };

beforeEach(() => { FakeSocket.opened = []; });

describe("the online roster a session holds", () => {
  const setup = () => renderHook(() => usePresence({ createSocket }));

  it("starts out empty and takes the roster it is handed", () => {
    const { result } = setup();
    expect(result.current).toEqual([]);

    latest().deliver({ kind: "presence.state", people: [mary, peter] });

    expect(result.current).toEqual([mary, peter]);
  });

  it("adds a person who arrives", () => {
    const { result } = setup();
    latest().deliver({ kind: "presence.state", people: [mary] });

    latest().deliver({ kind: "presence.joined", person: peter });

    expect(result.current).toEqual([mary, peter]);
  });

  it("keeps one entry when the same person is announced twice", () => {
    const { result } = setup();
    latest().deliver({ kind: "presence.state", people: [mary] });

    latest().deliver({ kind: "presence.joined", person: { ...mary, name: "Мария Ивановна" } });

    expect(result.current).toEqual([{ ...mary, name: "Мария Ивановна" }]);
  });

  it("drops a person who leaves", () => {
    const { result } = setup();
    latest().deliver({ kind: "presence.state", people: [mary, peter] });

    latest().deliver({ kind: "presence.left", userId: "u2" });

    expect(result.current).toEqual([peter]);
  });

  it("pays no attention to the other traffic on the connection", () => {
    const { result } = setup();
    latest().deliver({ kind: "presence.state", people: [mary] });

    latest().deliver({ kind: "task.moved", task: { id: "t1" } });
    latest().deliver({ kind: "crm.changed", board: "agency" });

    expect(result.current).toEqual([mary]);
  });

  it("closes the connection when the screen goes away", () => {
    const { unmount } = setup();

    unmount();

    expect(latest().closed).toBe(true);
  });
});
