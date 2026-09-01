import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useAuditEvents } from "@/entities/audit-event/index.js";
import { hookWrapper, server } from "@test/shared/index.js";

const event = {
  id: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  actorId: "33333333-3333-4333-8333-333333333333",
  actorName: "Maria",
  actorEmail: "maria@example.com",
  actorRole: "MANAGER",
  action: "UPDATE",
  entityType: "project",
  entityId: "44444444-4444-4444-8444-444444444444",
  clientId: "55555555-5555-4555-8555-555555555555",
  projectId: "44444444-4444-4444-8444-444444444444",
  campaignId: null,
  summary: "Изменён проект",
  changes: [{ field: "name", before: "Старое", after: "Новое" }],
  requestId: null,
  ip: null,
  userAgent: null,
  createdAt: "2026-08-31T10:00:00.000Z",
} as const;

describe("audit event queries", () => {
  it("loads filtered events and follows the cursor", async () => {
    const requests: URL[] = [];
    server.use(http.get("/api/audit", ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const cursor = url.searchParams.get("cursor");
      return HttpResponse.json(cursor
        ? { items: [{ ...event, id: "66666666-6666-4666-8666-666666666666" }], nextCursor: null }
        : { items: [event], nextCursor: event.id });
    }));

    const { result } = renderHook(
      () => useAuditEvents({ projectId: event.projectId, limit: 1 }),
      { wrapper: hookWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests[0]?.searchParams.get("projectId")).toBe(event.projectId);
    expect(requests[0]?.searchParams.get("limit")).toBe("1");

    let nextPageResult: Awaited<ReturnType<typeof result.current.fetchNextPage>> | undefined;
    await act(async () => { nextPageResult = await result.current.fetchNextPage(); });

    expect(requests[1]?.searchParams.get("cursor")).toBe(event.id);
    expect(nextPageResult?.data?.pages.flatMap((page) => page.items)).toHaveLength(2);
    expect(nextPageResult?.hasNextPage).toBe(false);
  });
});
