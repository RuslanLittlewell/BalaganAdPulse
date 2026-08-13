import { http as mock, HttpResponse, delay } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import { server } from "../../../test/server.js";
import { hookWrapper } from "../../../test/utils.js";
import {
  useCampaigns,
  useCampaignTable,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useCreateRecord,
  useUpdateRecord,
  useDeleteRecord,
  useSetValue,
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

describe("useSetValue", () => {
  const table = {
    id: "c1",
    clientId: "1",
    name: "Search ads",
    position: 0,
    properties: [
      { id: "p1", key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
    ],
    records: [{ id: "r1", date: "2026-08-01", values: { p1: "120.0000" } }],
    totals: { p1: "120.0000" },
  };

  it("puts the value and writes the answer into the table cache", async () => {
    let method = "";
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", async ({ request }) => {
        method = request.method;
        received = await request.json();
        return HttpResponse.json({
          record: { id: "r1", date: "2026-08-01", values: { p1: "200.0000" } },
          totals: { p1: "200.0000" },
        });
      }),
    );

    const wrapper = hookWrapper();
    const { result } = renderHook(
      () => ({ table: useCampaignTable("c1"), set: useSetValue("c1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.table.isSuccess).toBe(true));

    await result.current.set.mutateAsync({ recordId: "r1", propertyId: "p1", value: "200" });

    expect(method).toBe("PUT");
    expect(received).toEqual({ value: "200" });
    await waitFor(() => expect(result.current.table.data?.records[0].values.p1).toBe("200.0000"));
    expect(result.current.table.data?.totals.p1).toBe("200.0000");
  });

  it("ignores a stale answer that arrives after a newer one", async () => {
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", async ({ request }) => {
        const body = (await request.json()) as { value: string };
        // The first write answers last, so its response must not win.
        if (body.value === "200") await delay(50);
        return HttpResponse.json({
          record: { id: "r1", date: "2026-08-01", values: { p1: `${body.value}.0000` } },
          totals: { p1: `${body.value}.0000` },
        });
      }),
    );

    const wrapper = hookWrapper();
    const { result } = renderHook(
      () => ({ table: useCampaignTable("c1"), set: useSetValue("c1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.table.isSuccess).toBe(true));

    await act(async () => {
      // The slow write is issued first, so it carries the lower sequence number, but its
      // response is delayed and must not win once the fast write's answer applies.
      const slow = result.current.set.mutateAsync({ recordId: "r1", propertyId: "p1", value: "200" });
      const fast = result.current.set.mutateAsync({ recordId: "r1", propertyId: "p1", value: "300" });
      await Promise.all([slow, fast]);
    });

    expect(result.current.table.data?.records[0].values.p1).toBe("300.0000");
    expect(result.current.table.data?.totals.p1).toBe("300.0000");
  });

  it("still patches a straggler's own row when a later write lands for a different record", async () => {
    const twoRowTable = {
      ...table,
      records: [
        { id: "r1", date: "2026-08-01", values: { p1: "120.0000" } },
        { id: "r2", date: "2026-08-02", values: { p1: "50.0000" } },
      ],
    };
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(twoRowTable)),
      mock.put("/api/records/:recordId/values/:propertyId", async ({ request, params }) => {
        const body = (await request.json()) as { value: string };
        const recordId = params.recordId as string;
        // r1 is issued first but answers last, so it carries the lower sequence number.
        if (recordId === "r1") await delay(50);
        return HttpResponse.json({
          record: {
            id: recordId,
            date: recordId === "r1" ? "2026-08-01" : "2026-08-02",
            values: { p1: `${body.value}.0000` },
          },
          totals: { p1: `${body.value}.0000` },
        });
      }),
    );

    const wrapper = hookWrapper();
    const { result } = renderHook(
      () => {
        const table = useCampaignTable("c1");
        // React Query only tracks properties a render actually reads; touching `data`
        // here (unlike the other tests in this file) makes it register the two
        // *different*-record cache writes below as separate, individually-tracked
        // updates instead of coalescing them into one.
        void table.data;
        return { table, set: useSetValue("c1") };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.table.isSuccess).toBe(true));

    await act(async () => {
      // r1's write is issued first (lower sequence number) but its answer is the straggler;
      // it must still patch r1's own row even though it loses the totals race to r2's answer.
      const first = result.current.set.mutateAsync({ recordId: "r1", propertyId: "p1", value: "200" });
      const second = result.current.set.mutateAsync({ recordId: "r2", propertyId: "p1", value: "300" });
      await Promise.all([first, second]);
    });

    // r1's answer is the straggler and lands after r2's already rendered; wait for that
    // second render rather than asserting on the snapshot act() leaves behind.
    await waitFor(() => expect(result.current.table.data?.records[0].values.p1).toBe("200.0000"));
    expect(result.current.table.data?.records[1].values.p1).toBe("300.0000");
    expect(result.current.table.data?.totals.p1).toBe("300.0000");
  });
});

describe("useUpdateRecord", () => {
  it("patches the date and refetches the table, because the rows reorder", async () => {
    let method = "";
    let received: unknown;
    let gets = 0;
    const table = {
      id: "c1",
      clientId: "1",
      name: "Search ads",
      position: 0,
      properties: [
        { id: "p1", key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
      ],
      records: [{ id: "r1", date: "2026-08-01", values: { p1: "120.0000" } }],
      totals: { p1: "120.0000" },
    };
    server.use(
      mock.get("/api/campaigns/c1", () => {
        gets += 1;
        return HttpResponse.json(table);
      }),
      mock.patch("/api/records/r1", async ({ request }) => {
        method = request.method;
        received = await request.json();
        return HttpResponse.json({ id: "r1", campaignId: "c1", date: "2026-08-05" });
      }),
    );

    const wrapper = hookWrapper();
    const { result } = renderHook(
      () => ({ table: useCampaignTable("c1"), update: useUpdateRecord("c1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.table.isSuccess).toBe(true));

    await result.current.update.mutateAsync({ id: "r1", body: { date: "2026-08-05" } });

    expect(method).toBe("PATCH");
    expect(received).toEqual({ date: "2026-08-05" });
    await waitFor(() => expect(gets).toBe(2));
  });
});

describe("useDeleteRecord", () => {
  it("sends DELETE for one day", async () => {
    let method = "";
    server.use(
      mock.delete("/api/records/r1", ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteRecord("c1"), { wrapper: hookWrapper() });
    await result.current.mutateAsync("r1");

    expect(method).toBe("DELETE");
  });
});
