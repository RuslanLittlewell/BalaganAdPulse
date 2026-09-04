import { http as mock, HttpResponse, delay } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import { hookWrapper, server } from "@test/shared/index.js";
import { useMoveTask, useTasks, type Task } from "@/entities/task/index.js";

const task = (id: string, column: Task["column"], position: number): Task => ({
  id, projectId: "p1", orgId: "org1", title: id, description: null,
  column, priority: "LOW", assigneeId: null, createdById: null, campaignId: null, visibleToClient: false, position, imageIds: [],
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
});

const board = [task("a", "IDEA", 0), task("b", "IDEA", 1), task("x", "DONE", 0)];

function setup() {
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(["tasks", null], board);
  const { result } = renderHook(() => useMoveTask(), { wrapper });
  return { wrapper, result };
}

/**
 * The same, with the board query mounted.
 *
 * Without a mounted `useTasks` an invalidation is silent — React Query only
 * refetches queries something is observing — so a test for "does not refetch"
 * would pass against code that refetches on every drop.
 */
function setupWithBoard() {
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(["tasks", null], board);
  const { result } = renderHook(
    () => ({ move: useMoveTask(), board: useTasks({}) }),
    { wrapper },
  );
  return { wrapper, result };
}

const read = (wrapper: ReturnType<typeof hookWrapper>) =>
  wrapper.client.getQueryData<Task[]>(["tasks", null]) ?? [];

describe("useMoveTask", () => {
  /** The card must be in its new column in the very render that follows the
   * drop. If the cache is written a tick later, the board shows the card back
   * where it started for a frame — which reads as the card flying home. */
  it("moves the card in the cache before it awaits anything", async () => {
    server.use(mock.post("/api/tasks/a/move", async () => {
      await delay(50);
      return HttpResponse.json(task("a", "DONE", 0));
    }));
    const { wrapper, result } = setup();

    act(() => { result.current.mutate({ id: "a", body: { column: "DONE", position: 0 } }); });

    // No await between the drop and this read: the board renders now.
    const moved = read(wrapper).find((t) => t.id === "a");
    expect(moved).toMatchObject({ column: "DONE", position: 0 });
  });

  it("renumbers the column the card left, in the same write", () => {
    server.use(mock.post("/api/tasks/a/move", () => HttpResponse.json(task("a", "DONE", 0))));
    const { wrapper, result } = setup();

    act(() => { result.current.mutate({ id: "a", body: { column: "DONE", position: 0 } }); });

    expect(read(wrapper).find((t) => t.id === "b")).toMatchObject({ column: "IDEA", position: 0 });
    expect(read(wrapper).find((t) => t.id === "x")).toMatchObject({ column: "DONE", position: 1 });
  });

  it("puts the card back when the server refuses the move", async () => {
    server.use(mock.post("/api/tasks/a/move", () =>
      HttpResponse.json({ error: { message: "нельзя" } }, { status: 403 })));
    const { wrapper, result } = setup();

    act(() => { result.current.mutate({ id: "a", body: { column: "DONE", position: 0 } }); });
    expect(read(wrapper).find((t) => t.id === "a")?.column).toBe("DONE");

    await waitFor(() =>
      expect(read(wrapper).find((t) => t.id === "a")).toMatchObject({ column: "IDEA", position: 0 }));
  });
});

describe("useMoveTask does not poll the board", () => {
  // The whole point of the socket. The mover already has the result — from the
  // optimistic write and then from the response — and a refetch per drop costs
  // one request per person dragging, exactly when the board is busiest.
  it("does not refetch the task list after a move succeeds", async () => {
    let lists = 0;
    server.use(
      mock.get("/api/tasks", () => { lists += 1; return HttpResponse.json(board); }),
      mock.post("/api/tasks/a/move", () => HttpResponse.json(task("a", "DONE", 0))),
    );
    const { result } = setupWithBoard();
    // The board's own first load is not what this is about; count from after it.
    await waitFor(() => expect(result.current.board.isSuccess).toBe(true));
    lists = 0;

    act(() => { result.current.move.mutate({ id: "a", body: { column: "DONE", position: 0 } }); });
    await waitFor(() => expect(result.current.move.isSuccess).toBe(true));
    // Long enough for an invalidation to have turned into a request.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

    expect(lists).toBe(0);
  });

  // Removing the refetch removes the correction it used to provide, so the
  // response has to land in the cache instead of being discarded.
  it("writes the server's own row into the cache", async () => {
    server.use(mock.post("/api/tasks/a/move", () =>
      HttpResponse.json({ ...task("a", "DONE", 0), title: "Renamed by the server" })));
    const { wrapper, result } = setup();

    act(() => { result.current.mutate({ id: "a", body: { column: "DONE", position: 0 } }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(read(wrapper).find((t) => t.id === "a")).toMatchObject({
      title: "Renamed by the server", column: "DONE", position: 0,
    });
  });

  // A refused move must still put the card back, which was previously masked
  // by the refetch that followed.
  it("still rolls back a refused move without refetching", async () => {
    let lists = 0;
    server.use(
      mock.get("/api/tasks", () => { lists += 1; return HttpResponse.json(board); }),
      mock.post("/api/tasks/a/move", () =>
        HttpResponse.json({ error: { message: "nope" } }, { status: 403 })),
    );
    const { wrapper, result } = setupWithBoard();
    await waitFor(() => expect(result.current.board.isSuccess).toBe(true));
    lists = 0;

    act(() => { result.current.move.mutate({ id: "a", body: { column: "DONE", position: 0 } }); });
    await waitFor(() => expect(result.current.move.isError).toBe(true));

    expect(read(wrapper).find((t) => t.id === "a")).toMatchObject({ column: "IDEA", position: 0 });
    expect(lists).toBe(0);
  });
});
