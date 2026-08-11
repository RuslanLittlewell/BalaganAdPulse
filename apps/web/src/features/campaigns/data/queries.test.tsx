import { http as mock, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "../../../test/server.js";
import { hookWrapper } from "../../../test/utils.js";
import {
  useCampaigns,
  useCampaignTable,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useCreateRecord,
} from "./queries.js";

describe("useCampaigns", () => {
  it("loads the campaigns of one client", async () => {
    server.use(
      mock.get("/api/clients/1/campaigns", () =>
        HttpResponse.json([
          { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
        ]),
      ),
    );

    const { result } = renderHook(() => useCampaigns("1"), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Search ads");
  });

  it("stays idle without a client id", () => {
    const { result } = renderHook(() => useCampaigns(undefined), { wrapper: hookWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useCampaignTable", () => {
  it("loads the computed table of one campaign", async () => {
    server.use(
      mock.get("/api/campaigns/c1", () =>
        HttpResponse.json({
          id: "c1",
          clientId: "1",
          name: "Search ads",
          position: 0,
          properties: [{ id: "p1", key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null }],
          records: [{ id: "r1", date: "2026-08-01", values: { p1: "120.0000" } }],
          totals: { p1: "120.0000" },
        }),
      ),
    );

    const { result } = renderHook(() => useCampaignTable("c1"), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.properties[0].name).toBe("SPEND");
    expect(result.current.data?.records[0].values.p1).toBe("120.0000");
  });
});

describe("useCreateCampaign", () => {
  it("posts the name and returns the created campaign", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients/1/campaigns", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { id: "c9", clientId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateCampaign("1"), { wrapper: hookWrapper() });
    const created = await result.current.mutateAsync({ name: "Display" });

    expect(received).toEqual({ name: "Display" });
    expect(created.id).toBe("c9");
  });
});

describe("useUpdateCampaign", () => {
  it("patches the name of one campaign", async () => {
    let method = "";
    let received: unknown;
    server.use(
      mock.patch("/api/campaigns/c1", async ({ request }) => {
        method = request.method;
        received = await request.json();
        return HttpResponse.json(
          { id: "c1", clientId: "1", name: "Renamed", position: 0, createdAt: "", updatedAt: "" },
        );
      }),
    );

    const { result } = renderHook(() => useUpdateCampaign("1"), { wrapper: hookWrapper() });
    const updated = await result.current.mutateAsync({ id: "c1", body: { name: "Renamed" } });

    expect(method).toBe("PATCH");
    expect(received).toEqual({ name: "Renamed" });
    expect(updated.name).toBe("Renamed");
  });
});

describe("useCreateRecord", () => {
  it("posts a day to one campaign", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/campaigns/c1/records", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { id: "r1", campaignId: "c1", date: "2026-08-03" },
          { status: 201 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateRecord("c1"), { wrapper: hookWrapper() });
    const created = await result.current.mutateAsync({ date: "2026-08-03" });

    expect(received).toEqual({ date: "2026-08-03" });
    expect(created.date).toBe("2026-08-03");
  });
});

describe("useDeleteCampaign", () => {
  it("sends DELETE for one campaign", async () => {
    let method = "";
    server.use(
      mock.delete("/api/campaigns/c1", ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteCampaign("1"), { wrapper: hookWrapper() });
    await result.current.mutateAsync("c1");

    expect(method).toBe("DELETE");
  });
});
