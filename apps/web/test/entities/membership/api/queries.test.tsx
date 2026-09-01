import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, hookWrapper } from "@test/shared/index.js";
import { useMembers, useUpdateMember } from "@/entities/membership/index.js";

const member = {
  id: "membership-1",
  userId: "user-1",
  name: "Maria",
  email: "maria@example.com",
  image: null,
  role: "MANAGER",
  status: "ACTIVE",
  createdAt: "2026-08-31T10:00:00.000Z",
} as const;

describe("membership queries", () => {
  it("returns the organization member list", async () => {
    server.use(http.get("/api/members", () => HttpResponse.json([member])));

    const { result } = renderHook(() => useMembers(), { wrapper: hookWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]).toMatchObject({ name: "Maria", role: "MANAGER" });
  });

  it("updates a member and resolves the new representation", async () => {
    let received: unknown;
    server.use(http.patch("/api/members/:id", async ({ request }) => {
      received = await request.json();
      return HttpResponse.json({ ...member, role: "GUEST" });
    }));

    const { result } = renderHook(() => useUpdateMember(), { wrapper: hookWrapper() });
    const updated = await result.current.mutateAsync({ id: member.id, body: { role: "GUEST" } });

    expect(received).toEqual({ role: "GUEST" });
    expect(updated.role).toBe("GUEST");
  });
});
