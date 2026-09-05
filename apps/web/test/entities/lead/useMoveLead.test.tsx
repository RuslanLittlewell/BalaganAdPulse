import { http as mock, HttpResponse, delay } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { server } from "@test/shared/index.js";
import { hookWrapper } from "@test/shared/utils.js";
import { leadsKey, useMoveLead, type Lead } from "@/entities/lead/index.js";

const lead = (id: string, stage: Lead["stage"], position: number): Lead => ({
  id, orgId: "org-1", clientId: null, name: id, company: null, phone: null, email: null,
  website: null, source: null, notes: null, projectId: null, campaignId: null, stage, position,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
});

const board = [lead("a", "NEW", 0), lead("b", "NEW", 1)];

const order = (rows: Lead[] | undefined, stage: Lead["stage"]) =>
  (rows ?? []).filter((row) => row.stage === stage)
    .sort((a, b) => a.position - b.position).map((row) => row.id);

describe("useMoveLead", () => {
  it("shows the move before the API answers, then keeps what the API sends back", async () => {
    server.use(mock.patch("/api/crm/boards/agency/leads/a/move", async () => {
      await delay(60);
      return HttpResponse.json([lead("b", "NEW", 0), lead("a", "WON", 0)]);
    }));
    const wrapper = hookWrapper();
    wrapper.client.setQueryData(leadsKey("agency"), board);

    const { result } = renderHook(() => useMoveLead("agency"), { wrapper });
    result.current.mutate({ id: "a", body: { stage: "WON", position: 0 } });

    await waitFor(() =>
      expect(order(wrapper.client.getQueryData<Lead[]>(leadsKey("agency")), "WON")).toEqual(["a"]));
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(order(wrapper.client.getQueryData<Lead[]>(leadsKey("agency")), "NEW")).toEqual(["b"]);
  });

  it("puts the board back the way the server has it when the move is refused", async () => {
    server.use(
      mock.patch("/api/crm/boards/agency/leads/a/move", () =>
        HttpResponse.json({ error: { message: "no" } }, { status: 409 })),
      mock.get("/api/crm/boards/agency/leads", () => HttpResponse.json(board)),
    );
    const wrapper = hookWrapper();
    wrapper.client.setQueryData(leadsKey("agency"), board);

    const { result } = renderHook(() => useMoveLead("agency"), { wrapper });
    result.current.mutate({ id: "a", body: { stage: "WON", position: 0 } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    await waitFor(() =>
      expect(order(wrapper.client.getQueryData<Lead[]>(leadsKey("agency")), "NEW")).toEqual(["a", "b"]));
    expect(order(wrapper.client.getQueryData<Lead[]>(leadsKey("agency")), "WON")).toEqual([]);
  });

  it("leaves another board's cache alone", async () => {
    server.use(mock.patch("/api/crm/boards/agency/leads/a/move", () =>
      HttpResponse.json([lead("a", "WON", 0), lead("b", "NEW", 0)])));
    const wrapper = hookWrapper();
    wrapper.client.setQueryData(leadsKey("agency"), board);
    wrapper.client.setQueryData(leadsKey("client-1"), [lead("z", "NEW", 0)]);

    const { result } = renderHook(() => useMoveLead("agency"), { wrapper });
    result.current.mutate({ id: "a", body: { stage: "WON", position: 0 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(order(wrapper.client.getQueryData<Lead[]>(leadsKey("client-1")), "NEW")).toEqual(["z"]);
  });
});
