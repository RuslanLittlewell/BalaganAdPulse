import { http as mock, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { hookWrapper, server } from "@test/shared/index.js";
import { useMembers } from "@/entities/membership/index.js";

/**
 * Everywhere colleagues are shown — the employee directory, the assignee select,
 * the name on a card — means the agency's own people. A customer holds a
 * membership too, and turning up in those lists is what this asks the server to
 * prevent.
 */
describe("useMembers", () => {
  it("asks for staff, not for every membership", async () => {
    const seen: URL[] = [];
    server.use(mock.get("/api/members", ({ request }) => {
      seen.push(new URL(request.url));
      return HttpResponse.json([]);
    }));

    const { result } = renderHook(() => useMembers(), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].searchParams.get("kind")).toBe("staff");
  });
});
