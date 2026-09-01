import { describe, expect, it } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { createCampaignUseCases } from "../../src/modules/campaigns/application/campaign-use-cases.js";
import type { MeasuredDay } from "../../src/modules/campaigns/domain/metrics.js";
import type { Ad, AdSet, Campaign } from "../../src/modules/campaigns/domain/hierarchy.js";

const admin: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "ADMIN" };
const customer: ActorContext = { ...admin, membershipId: "m4", role: "CLIENT" };

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const range = { from: day("2026-08-01"), to: day("2026-08-03") };

const measured = (partial: Partial<MeasuredDay> = {}): MeasuredDay => ({
  date: day("2026-08-02"),
  spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0, ...partial,
});

const campaign = (partial: Partial<Campaign> = {}): Campaign => ({
  id: "c1", projectId: "p1", name: "Поиск / Москва", channel: "YANDEX",
  status: "ACTIVE", objective: null, externalId: null, position: 0, ...partial,
});

function fixture(options: {
  campaigns?: Campaign[];
  adSets?: AdSet[];
  ads?: Ad[];
  reachableProjects?: string[];
  campaignDays?: Record<string, MeasuredDay[]>;
  adSetDays?: Record<string, MeasuredDay[]>;
  adDays?: Record<string, MeasuredDay[]>;
} = {}) {
  const campaigns = options.campaigns ?? [campaign()];
  const reachable = options.reachableProjects ?? ["p1"];
  const visible = campaigns.filter((c) => reachable.includes(c.projectId));

  return createCampaignUseCases({
    campaigns: {
      findReachable: async (_actor, id) => visible.find((c) => c.id === id) ?? null,
      listReachableByProject: async (_actor, projectId) =>
        visible.filter((c) => c.projectId === projectId),
      listReachable: async () => visible,
    },
    adSets: {
      listByCampaign: async (campaignId) =>
        (options.adSets ?? []).filter((s) => s.campaignId === campaignId),
      findById: async (id) => (options.adSets ?? []).find((s) => s.id === id) ?? null,
    },
    ads: {
      listByAdSet: async (adSetId) => (options.ads ?? []).filter((a) => a.adSetId === adSetId),
    },
    projects: { isReachable: async (_actor, projectId) => reachable.includes(projectId) },
    metrics: {
      recordCampaignDay: async () => undefined,
      recordAdSetDay: async () => undefined,
      recordAdDay: async () => undefined,
      readCampaignRange: async (id) => options.campaignDays?.[id] ?? [],
      readAdSetRange: async (id) => options.adSetDays?.[id] ?? [],
      readAdRange: async (id) => options.adDays?.[id] ?? [],
    },
  });
}

describe("reading the hierarchy", () => {
  it("returns a campaign with the figures of the range beside it", async () => {
    const useCases = fixture({
      campaignDays: { c1: [measured({ spend: 100, clicks: 20, impressions: 2000 })] },
    });

    const read = await useCases.readCampaign(admin, "c1", range);

    expect(read).toMatchObject({ id: "c1", channel: "YANDEX" });
    expect(read.performance).toMatchObject({ spend: 100, clicks: 20, ctr: 1 });
  });

  it("lists a campaign's ad sets, each with its own figures", async () => {
    const useCases = fixture({
      adSets: [{ id: "s1", campaignId: "c1", name: "Москва", audience: null, status: "ACTIVE", externalId: null, position: 0 }],
      adSetDays: { s1: [measured({ spend: 60, conversions: 3 })] },
    });

    const sets = await useCases.listAdSets(admin, "c1", range);

    expect(sets).toHaveLength(1);
    expect(sets[0]!.performance).toMatchObject({ spend: 60, cpa: 20 });
  });

  it("lists an ad set's ads", async () => {
    const useCases = fixture({
      adSets: [{ id: "s1", campaignId: "c1", name: "Москва", audience: null, status: "ACTIVE", externalId: null, position: 0 }],
      ads: [{ id: "a1", adSetId: "s1", name: "Приём сегодня", format: null, headline: null, status: "ACTIVE", externalId: null, position: 0 }],
      adDays: { a1: [measured({ spend: 25 })] },
    });

    const ads = await useCases.listAds(admin, "s1", range);

    expect(ads[0]).toMatchObject({ id: "a1", performance: { spend: 25 } });
  });
});

describe("reach, checked before anything is looked up", () => {
  it("hides a campaign under a project the actor holds no grant over", async () => {
    const useCases = fixture({ reachableProjects: [] });
    await expect(useCases.readCampaign(admin, "c1", range))
      .rejects.toMatchObject({ category: "not-found" });
  });

  /** 404, not 403: a refusal must never confirm that the thing exists. */
  it("answers not-found rather than forbidden for an unreachable ad set", async () => {
    const useCases = fixture({
      adSets: [{ id: "s1", campaignId: "c1", name: "Москва", audience: null, status: "ACTIVE", externalId: null, position: 0 }],
      reachableProjects: [],
    });

    await expect(useCases.listAds(admin, "s1", range))
      .rejects.toMatchObject({ category: "not-found" });
  });

  /**
   * A customer reads campaigns — the matrix grants `read` to every role,
   * deliberately, because the client portal shows them their own results. What
   * limits them is reach, not the verb.
   */
  it("lets a customer read a campaign they reach", async () => {
    const useCases = fixture();
    await expect(useCases.readCampaign(customer, "c1", range)).resolves.toMatchObject({ id: "c1" });
  });

  it("still hides one they do not reach from that customer", async () => {
    const useCases = fixture({ reachableProjects: [] });
    await expect(useCases.readCampaign(customer, "c1", range))
      .rejects.toMatchObject({ category: "not-found" });
  });
});

describe("summarising a parent", () => {
  it("sums a project from its campaigns", async () => {
    const useCases = fixture({
      campaigns: [campaign({ id: "c1" }), campaign({ id: "c2" })],
      campaignDays: {
        c1: [measured({ spend: 100, conversions: 4 })],
        c2: [measured({ spend: 60, conversions: 2 })],
      },
    });

    const summary = await useCases.projectSummary(admin, "p1", range);

    expect(summary).toMatchObject({ spend: 160, conversions: 6, cpa: 160 / 6 });
  });

  it("sums the agency from every project the member reaches", async () => {
    const useCases = fixture({
      campaigns: [campaign({ id: "c1", projectId: "p1" }), campaign({ id: "c2", projectId: "p2" })],
      reachableProjects: ["p1", "p2"],
      campaignDays: { c1: [measured({ spend: 100 })], c2: [measured({ spend: 40 })] },
    });

    expect(await useCases.agencySummary(admin, range)).toMatchObject({ spend: 140 });
  });

  // The summary is not the agency's total, it is this member's view of it.
  it("leaves out a project the member holds no grant over", async () => {
    const useCases = fixture({
      campaigns: [campaign({ id: "c1", projectId: "p1" }), campaign({ id: "c2", projectId: "p2" })],
      reachableProjects: ["p1"],
      campaignDays: { c1: [measured({ spend: 100 })], c2: [measured({ spend: 40 })] },
    });

    expect(await useCases.agencySummary(admin, range)).toMatchObject({ spend: 100 });
  });

  it("summarises an empty project to zero rather than to nothing", async () => {
    const useCases = fixture({ campaigns: [] });
    expect(await useCases.projectSummary(admin, "p1", range)).toMatchObject({ spend: 0, cpa: null });
  });
});

describe("validating the range", () => {
  it("refuses a range that ends before it starts", async () => {
    const useCases = fixture();
    await expect(useCases.readCampaign(admin, "c1", { from: day("2026-08-05"), to: day("2026-08-01") }))
      .rejects.toMatchObject({ category: "validation" });
  });
});

describe("the days themselves", () => {
  it("returns a campaign's measured days with their dates, unsummed", async () => {
    const useCases = fixture({ campaignDays: { c1: [
      measured({ date: day("2026-08-01"), spend: 400 }),
      measured({ date: day("2026-08-02"), spend: 600 }),
    ] } });

    const series = await useCases.dailySeries(admin, "c1", range);

    expect(series.map((entry) => entry.spend)).toEqual([400, 600]);
    expect(series[0].date).toEqual(day("2026-08-01"));
  });

  // The dashboard draws a project's shape over time, and a project measures
  // nothing itself: its series is its campaigns' days added up per date.
  it("adds a project's campaigns together per date", async () => {
    const useCases = fixture({
      campaigns: [campaign(), campaign({ id: "c2", name: "Второй" })],
      campaignDays: {
        c1: [measured({ date: day("2026-08-01"), spend: 400 }),
             measured({ date: day("2026-08-02"), spend: 600 })],
        c2: [measured({ date: day("2026-08-02"), spend: 100 })],
      },
    });

    const series = await useCases.projectDailySeries(admin, "p1", range);

    expect(series.map((entry) => entry.spend)).toEqual([400, 700]);
  });

  it("404s a project series the member cannot reach", async () => {
    const useCases = fixture({ reachableProjects: [] });

    await expect(useCases.projectDailySeries(admin, "p1", range))
      .rejects.toMatchObject({ category: "not-found" });
  });

  it("refuses a role that may not read campaigns at all", async () => {
    const useCases = fixture();
    await expect(useCases.projectDailySeries({ ...customer, role: "NOBODY" as never }, "p1", range))
      .rejects.toMatchObject({ category: "forbidden" });
  });
});

describe("the agency's channels", () => {
  it("groups the member's campaigns by channel", async () => {
    const useCases = fixture({
      campaigns: [
        campaign({ id: "c1", channel: "YANDEX" }),
        campaign({ id: "c2", channel: "META" }),
        campaign({ id: "c3", channel: "YANDEX" }),
      ],
      campaignDays: {
        c1: [measured({ spend: 400, clicks: 100 })],
        c2: [measured({ spend: 250, clicks: 50 })],
        c3: [measured({ spend: 100, clicks: 25 })],
      },
    });

    const channels = await useCases.channelSummary(admin, range);

    expect(channels).toEqual([
      { channel: "YANDEX", campaigns: 2, performance: expect.objectContaining({ spend: 500, cpc: 4 }) },
      { channel: "META", campaigns: 1, performance: expect.objectContaining({ spend: 250, cpc: 5 }) },
    ]);
  });

  // Biggest spend first: the panel is read to see where the money goes.
  it("orders the channels by spend, largest first", async () => {
    const useCases = fixture({
      campaigns: [campaign({ id: "c1", channel: "VK" }), campaign({ id: "c2", channel: "META" })],
      campaignDays: { c1: [measured({ spend: 10 })], c2: [measured({ spend: 90 })] },
    });

    expect((await useCases.channelSummary(admin, range)).map((entry) => entry.channel))
      .toEqual(["META", "VK"]);
  });

  it("leaves out a channel the member reaches no campaign on", async () => {
    const useCases = fixture({ campaigns: [campaign({ channel: "TELEGRAM" })] });

    expect((await useCases.channelSummary(admin, range)).map((entry) => entry.channel))
      .toEqual(["TELEGRAM"]);
  });
});
