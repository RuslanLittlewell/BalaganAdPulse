import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, hookWrapper } from "@test/shared/index.js";
import { useLeadColumns } from "@/entities/lead/api/queries.js";

describe("useLeadColumns", () => {
  it("does not refetch a board's columns on a second mount right after the first", async () => {
    let requests = 0;
    server.use(http.get("/api/crm/boards/project-1/columns", () => {
      requests += 1;
      return HttpResponse.json([{ id: "col-1", kind: "FIXED", name: "Новый", position: 0 }]);
    }));
    const wrapper = hookWrapper();

    const first = renderHook(() => useLeadColumns("project-1"), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useLeadColumns("project-1"), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(requests).toBe(1);
  });
});
