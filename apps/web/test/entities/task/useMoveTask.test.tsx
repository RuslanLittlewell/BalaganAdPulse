import { http as mock, HttpResponse, delay } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import { hookWrapper, server } from "@test/shared/index.js";
import { useMoveTask, type Task } from "@/entities/task/index.js";

const task = (id: string, column: Task["column"], position: number): Task => ({
  id, projectId: "p1", orgId: "org1", title: id, description: null,
  column, priority: "LOW", assigneeId: null, createdById: null, position, imageIds: [],
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
});

const board = [task("a", "IDEA", 0), task("b", "IDEA", 1), task("x", "DONE", 0)];

function setup() {
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(["tasks", null], board);
  const { result } = renderHook(() => useMoveTask(), { wrapper });
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
