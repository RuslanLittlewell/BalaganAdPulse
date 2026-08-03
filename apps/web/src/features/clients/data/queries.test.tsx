import { http as mock, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "../../../test/server.js";
import { hookWrapper } from "../../../test/utils.js";
import { useClients, useCreateClient } from "./queries.js";

describe("client queries", () => {
  it("useClients returns the list", async () => {
    server.use(
      mock.get("/api/clients", () =>
        HttpResponse.json([
          { id: "1", name: "Acme", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" },
        ]),
      ),
    );
    const { result } = renderHook(() => useClients(), { wrapper: hookWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Acme");
  });

  it("useCreateClient posts the input and resolves the created client", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { id: "2", name: "New", niche: null, monthlyBudget: "1000", email: null, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const { result } = renderHook(() => useCreateClient(), { wrapper: hookWrapper() });
    const created = await result.current.mutateAsync({ name: "New", monthlyBudget: 1000 });
    expect(received).toEqual({ name: "New", monthlyBudget: 1000 });
    expect(created.id).toBe("2");
  });
});
