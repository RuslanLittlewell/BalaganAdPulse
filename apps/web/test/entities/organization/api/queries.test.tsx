import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, hookWrapper } from "@test/shared/index.js";
import { useOrganization } from "@/entities/organization/index.js";

describe("organization queries", () => {
  it("reads the organization from the current session", async () => {
    server.use(http.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Admin", email: "admin@example.com", image: null },
      organization: { id: "org-7", name: "North Agency", slug: "north" },
      role: "ADMIN",
      clientIds: [],
    })));

    const { result } = renderHook(() => useOrganization(), { wrapper: hookWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({ id: "org-7", name: "North Agency", slug: "north" });
  });
});
