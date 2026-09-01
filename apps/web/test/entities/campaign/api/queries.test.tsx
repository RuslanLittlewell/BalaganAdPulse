import { http as mock, HttpResponse } from "msw";
import { renderHook, waitFor } from "@testing-library/react";
import { server, hookWrapper } from "@test/shared/index.js";
import {
  useAds,
  useAdSets,
  useAgencySummary,
  useChannelShares,
  useCampaign,
  useCampaignDaily,
  useProjectCampaigns,
  useProjectDaily,
  useProjectSummary,
} from "@/entities/campaign/api/queries.js";
import type { DateRange } from "@/entities/campaign/index.js";

const RANGE: DateRange = { from: "2026-08-01", to: "2026-08-31" };

const performance = {
  spend: 1000, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5,
};

/** Every reading is scoped to a range, so every request must carry both ends.
 * A hook that forgot one would still render — with figures for a period the
 * viewer never asked for. */
function capturing(path: string, body: object) {
  const seen: URL[] = [];
  server.use(mock.get(path, ({ request }) => {
    seen.push(new URL(request.url));
    return HttpResponse.json(body);
  }));
  return seen;
}

describe("useProjectCampaigns", () => {
  it("loads the campaigns of one project over a range", async () => {
    const seen = capturing("/api/projects/p1/campaigns", [
      { id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "YANDEX", status: "ACTIVE",
        objective: null, externalId: null, position: 0, performance },
    ]);

    const { result } = renderHook(() => useProjectCampaigns("p1", RANGE), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].channel).toBe("YANDEX");
    expect(result.current.data?.[0].performance.roas).toBe(4);
    expect(seen[0].searchParams.get("from")).toBe("2026-08-01");
    expect(seen[0].searchParams.get("to")).toBe("2026-08-31");
  });

  it("stays idle without a project id", () => {
    const { result } = renderHook(() => useProjectCampaigns(undefined, RANGE), {
      wrapper: hookWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  // Two ranges are two answers. Sharing one cache entry would let July's
  // figures land under August's label — the second fetch overwrites the first,
  // and both observers read the overwritten entry.
  it("keeps each range's figures apart", async () => {
    server.use(mock.get("/api/projects/p1/campaigns", ({ request }) => {
      const from = new URL(request.url).searchParams.get("from") as string;
      return HttpResponse.json([
        { id: "c1", projectId: "p1", name: from, channel: "YANDEX", status: "ACTIVE",
          objective: null, externalId: null, position: 0, performance },
      ]);
    }));
    const wrapper = hookWrapper();

    const august = renderHook(() => useProjectCampaigns("p1", RANGE), { wrapper });
    await waitFor(() => expect(august.result.current.isSuccess).toBe(true));
    const july = renderHook(
      () => useProjectCampaigns("p1", { from: "2026-07-01", to: "2026-07-31" }),
      { wrapper },
    );
    await waitFor(() => expect(july.result.current.isSuccess).toBe(true));

    expect(july.result.current.data?.[0].name).toBe("2026-07-01");
    expect(august.result.current.data?.[0].name).toBe("2026-08-01");
  });
});

describe("useCampaign", () => {
  it("loads one campaign with its figures", async () => {
    const seen = capturing("/api/campaigns/c1", {
      id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "YANDEX", status: "ACTIVE",
      objective: "Заявки", externalId: null, position: 0, performance,
    });

    const { result } = renderHook(() => useCampaign("c1", RANGE), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.objective).toBe("Заявки");
    expect(seen[0].searchParams.get("to")).toBe("2026-08-31");
  });
});

describe("the levels beneath a campaign", () => {
  it("loads ad sets and ads over the same range", async () => {
    capturing("/api/campaigns/c1/ad-sets", [
      { id: "s1", campaignId: "c1", name: "Москва · 28–55", audience: "Гео Москва",
        status: "ACTIVE", externalId: null, position: 0, performance },
    ]);
    const adRequests = capturing("/api/ad-sets/s1/ads", [
      { id: "a1", adSetId: "s1", name: "Приём сегодня", format: "Текст", headline: null,
        status: "ACTIVE", externalId: null, position: 0, performance },
    ]);

    const sets = renderHook(() => useAdSets("c1", RANGE), { wrapper: hookWrapper() });
    await waitFor(() => expect(sets.result.current.isSuccess).toBe(true));
    expect(sets.result.current.data?.[0].audience).toBe("Гео Москва");

    const ads = renderHook(() => useAds("s1", RANGE), { wrapper: hookWrapper() });
    await waitFor(() => expect(ads.result.current.isSuccess).toBe(true));
    expect(ads.result.current.data?.[0].format).toBe("Текст");
    expect(adRequests[0].searchParams.get("from")).toBe("2026-08-01");
  });

  it("stays idle without an ad set id", () => {
    const { result } = renderHook(() => useAds(undefined, RANGE), { wrapper: hookWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useCampaignDaily", () => {
  it("loads the measured days themselves, unsummed", async () => {
    capturing("/api/campaigns/c1/daily", [
      { date: "2026-08-01", spend: 400, impressions: 40000, reach: 20000, clicks: 800,
        conversions: 20, revenue: 1600 },
      { date: "2026-08-02", spend: 600, impressions: 60000, reach: 20000, clicks: 1200,
        conversions: 30, revenue: 2400 },
    ]);

    const { result } = renderHook(() => useCampaignDaily("c1", RANGE), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[1].spend).toBe(600);
  });
});

describe("useProjectDaily", () => {
  it("loads a project's days, already added up per date", async () => {
    const seen = capturing("/api/projects/p1/daily", [
      { date: "2026-08-01", spend: 400, impressions: 40000, reach: 20000, clicks: 800,
        conversions: 20, revenue: 1600 },
    ]);

    const { result } = renderHook(() => useProjectDaily("p1", RANGE), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].date).toBe("2026-08-01");
    expect(seen[0].searchParams.get("to")).toBe("2026-08-31");
  });
});

describe("summaries", () => {
  it("loads the agency total", async () => {
    const seen = capturing("/api/summary", performance);

    const { result } = renderHook(() => useAgencySummary(RANGE), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.spend).toBe(1000);
    expect(seen[0].searchParams.get("from")).toBe("2026-08-01");
  });

  it("loads the agency split by channel", async () => {
    capturing("/api/summary/channels", [
      { channel: "META", campaigns: 3, performance },
    ]);

    const { result } = renderHook(() => useChannelShares(RANGE), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].campaigns).toBe(3);
  });

  it("loads one project's total", async () => {
    capturing("/api/projects/p1/summary", { ...performance, spend: 250 });

    const { result } = renderHook(() => useProjectSummary("p1", RANGE), { wrapper: hookWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.spend).toBe(250);
  });

  it("stays idle without a project id", () => {
    const { result } = renderHook(() => useProjectSummary(undefined, RANGE), {
      wrapper: hookWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
