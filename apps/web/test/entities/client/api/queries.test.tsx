import { http as mock, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "@test/shared/index.js";
import { hookWrapper } from "@test/shared/index.js";
import { useClients, useCreateClient } from "@/entities/client/api/queries.js";

describe("client queries", () => {
  it("useClients returns the list", async () => {
    server.use(
      mock.get("/api/clients", () =>
        HttpResponse.json([
          { id: "1", name: "Acme", niche: null, email: null, createdAt: "", updatedAt: "" },
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
          { id: "2", name: "New", niche: null, email: null, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const { result } = renderHook(() => useCreateClient(), { wrapper: hookWrapper() });
    const created = await result.current.mutateAsync({ name: "New"});
    expect(received).toEqual({ name: "New"});
    expect(created.id).toBe("2");
  });
});
