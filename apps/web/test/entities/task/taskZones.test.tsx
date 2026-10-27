import { http as mock, HttpResponse, delay } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import { aTask, hookWrapper, server } from "@test/shared/index.js";
import { tasksApi, useCompleteTask, useTaskEvents, useTasks, type Task } from "@/entities/task/index.js";

const fromMinsk = aTask({ id: "a", dueDate: "2026-09-25", dueTime: "10:00", endTime: "11:00", timeZone: "Europe/Minsk" });

describe("tasks read from the API", () => {
  it("are shown in the member's own time zone", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([fromMinsk])));

    const { result } = renderHook(() => useTasks(), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      dueDate: "2026-09-25", dueTime: "16:00", endTime: "17:00", timeZone: "Europe/Minsk",
    });
  });

  it("are shown in the member's zone when another member's change arrives", async () => {
    class FakeSocket {
      static last: FakeSocket | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { FakeSocket.last = this; }
      close() {}
    }
    const wrapper = hookWrapper();
    wrapper.client.setQueryData(["tasks", null], [aTask({ id: "a" })]);
    renderHook(() => useTaskEvents({ createSocket: () => new FakeSocket() as never }), { wrapper });
    await waitFor(() => expect(FakeSocket.last).not.toBeNull());

    act(() => {
      FakeSocket.last!.onmessage?.({ data: JSON.stringify({ kind: "task.updated", orgId: "org-1", projectId: "project-1", task: fromMinsk }) });
    });

    expect(wrapper.client.getQueryData<Task[]>(["tasks", null])?.[0]).toMatchObject({ dueDate: "2026-09-25", dueTime: "16:00" });
  });
});

describe("tasks written to the API", () => {
  function capturing() {
    const sent: Record<string, unknown>[] = [];
    server.use(
      mock.post("/api/tasks", async ({ request }) => {
        sent.push(await request.json() as Record<string, unknown>);
        return HttpResponse.json(fromMinsk, { status: 201 });
      }),
      mock.patch("/api/tasks/a", async ({ request }) => {
        sent.push(await request.json() as Record<string, unknown>);
        return HttpResponse.json(fromMinsk);
      }),
    );
    return sent;
  }

  it("name the member's zone with a day or time", async () => {
    const sent = capturing();

    await tasksApi.create({ title: "Созвон", priority: "MEDIUM", dueDate: "2026-09-25", dueTime: "16:00" });

    expect(sent[0]).toMatchObject({ dueDate: "2026-09-25", dueTime: "16:00", timeZone: "Asia/Tokyo" });
  });

  it("name no zone when they carry no day or time", async () => {
    const sent = capturing();

    await tasksApi.update("a", { title: "Планёрка" });

    expect(sent[0]).toEqual({ title: "Планёрка" });
  });

  it("are answered in the member's zone", async () => {
    capturing();

    expect(await tasksApi.update("a", { title: "Планёрка" })).toMatchObject({ dueDate: "2026-09-25", dueTime: "16:00" });
  });
});

describe("completing a task that skips weekends", () => {
  it("moves it from Friday to Monday before the server answers", async () => {
    server.use(mock.post("/api/tasks/a/complete", async () => {
      await delay(50);
      return HttpResponse.json(aTask({ id: "a", dueDate: "2026-10-26", repeatEvery: "DAILY", skipWeekends: true }));
    }));
    const wrapper = hookWrapper();
    wrapper.client.setQueryData(["tasks", null], [aTask({ id: "a", dueDate: "2026-10-23", repeatEvery: "DAILY", skipWeekends: true })]);
    const { result } = renderHook(() => useCompleteTask(), { wrapper });

    act(() => { result.current.mutate("a"); });

    expect(wrapper.client.getQueryData<Task[]>(["tasks", null])?.[0]?.dueDate).toBe("2026-10-26");
  });
});
