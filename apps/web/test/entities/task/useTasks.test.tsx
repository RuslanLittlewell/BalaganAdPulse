import { http as mock, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { aTask, hookWrapper, server } from "@test/shared/index.js";
import { useTasks } from "@/entities/task/index.js";

function capturing(body: unknown[] = []) {
  const seen: URL[] = [];
  server.use(mock.get("/api/tasks", ({ request }) => {
    seen.push(new URL(request.url));
    return HttpResponse.json(body);
  }));
  return seen;
}

describe("useTasks", () => {
  it("asks for one campaign's tasks", async () => {
    const seen = capturing([aTask({ campaignId: "camp-1" })]);

    const { result } = renderHook(() => useTasks({ campaignId: "camp-1" }), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].searchParams.get("campaignId")).toBe("camp-1");
  });

  it("asks for one project's tasks", async () => {
    const seen = capturing();

    const { result } = renderHook(() => useTasks({ projectId: "p1" }), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].searchParams.get("projectId")).toBe("p1");
    expect(seen[0].searchParams.get("campaignId")).toBeNull();
  });

  it("keeps each campaign's answer apart", async () => {
    server.use(mock.get("/api/tasks", ({ request }) => {
      const campaignId = new URL(request.url).searchParams.get("campaignId") as string;
      return HttpResponse.json([aTask({ id: campaignId, title: campaignId })]);
    }));
    const wrapper = hookWrapper();

    const first = renderHook(() => useTasks({ campaignId: "camp-1" }), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    const second = renderHook(() => useTasks({ campaignId: "camp-2" }), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(second.result.current.data?.[0].title).toBe("camp-2");
    expect(first.result.current.data?.[0].title).toBe("camp-1");
  });
});
