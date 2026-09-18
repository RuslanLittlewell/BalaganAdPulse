import { http as mock, HttpResponse, delay } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import { hookWrapper, server } from "@test/shared/index.js";
import { useRescheduleTask, type Task } from "@/entities/task/index.js";

const task = (id: string, dueDate: string | null, dueTime: string | null = null): Task => ({
  id, projectId: "p1", orgId: "org1", title: id, description: null,
  column: "IDEA", priority: "LOW", assigneeId: null, createdById: null, campaignId: null,
  visibleToClient: false, position: 0, dueDate, dueTime, repeatEvery: "NONE", checklist: [],
  imageIds: [], createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
});

function setup() {
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(["tasks", null], [task("a", "2026-09-16", "12:00")]);
  const { result } = renderHook(() => useRescheduleTask(), { wrapper });
  return { wrapper, result };
}

const read = (wrapper: ReturnType<typeof hookWrapper>) =>
  wrapper.client.getQueryData<Task[]>(["tasks", null]) ?? [];

describe("useRescheduleTask", () => {
  it("moves the card to its new day before the server answers", async () => {
    server.use(mock.patch("/api/tasks/a", async () => {
      await delay(50);
      return HttpResponse.json(task("a", "2026-09-17", "12:00"));
    }));
    const { wrapper, result } = setup();

    act(() => { result.current.mutate({ id: "a", dueDate: "2026-09-17" }); });

    expect(read(wrapper)[0]).toMatchObject({ dueDate: "2026-09-17", dueTime: "12:00" });
  });

  it("sends the day and nothing else, so the time of day survives", async () => {
    let sent: unknown = null;
    server.use(mock.patch("/api/tasks/a", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(task("a", "2026-09-17", "12:00"));
    }));
    const { result } = setup();

    act(() => { result.current.mutate({ id: "a", dueDate: "2026-09-17" }); });

    await waitFor(() => expect(sent).toEqual({ dueDate: "2026-09-17" }));
  });

  it("sends the time when a calendar drop chooses a slot", async () => {
    let sent: unknown = null;
    server.use(mock.patch("/api/tasks/a", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json(task("a", "2026-09-17", "09:30"));
    }));
    const { wrapper, result } = setup();

    act(() => { result.current.mutate({ id: "a", dueDate: "2026-09-17", dueTime: "09:30" }); });

    await waitFor(() => expect(sent).toEqual({ dueDate: "2026-09-17", dueTime: "09:30" }));
    expect(read(wrapper)[0]).toMatchObject({ dueDate: "2026-09-17", dueTime: "09:30" });
  });

  it("puts the card back on its own day when the server refuses", async () => {
    server.use(mock.patch("/api/tasks/a", () =>
      HttpResponse.json({ error: { message: "нельзя" } }, { status: 403 })));
    const { wrapper, result } = setup();

    act(() => { result.current.mutate({ id: "a", dueDate: "2026-09-17" }); });

    await waitFor(() => expect(read(wrapper)[0]).toMatchObject({ dueDate: "2026-09-16" }));
  });
});
