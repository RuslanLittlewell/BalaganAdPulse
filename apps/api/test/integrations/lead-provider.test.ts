import { describe, expect, it, vi } from "vitest";
import { GraphProvider } from "../../src/modules/integrations/infrastructure/graph-provider.js";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

const liveAd = (id: string, objective: string) => ({
  id, name: `Объявление ${id}`, effective_status: "ACTIVE",
  adset: { id: `1${id}0`, name: `Группа ${id}` },
  campaign: { id: `2${id}0`, name: `Кампания ${id}`, objective },
});

const polled = {
  adId: "555", adName: "Видео 1",
  adSet: { externalId: "s1", name: "Москва" },
  campaign: { externalId: "c1", name: "Весна" },
};

const metaLead = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, created_time: "2026-09-10T10:00:00+0000", ad_id: "555", form_id: "777",
  field_data: [{ name: "full_name", values: ["Анна Петрова"] }, { name: "phone_number", values: ["+375291234567"] }],
  ...overrides,
});

describe("listing ads that can collect Instant Form leads", () => {
  it("reads delivering ads of the account across pages and keeps lead campaigns only", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ data: [liveAd("1", "OUTCOME_LEADS"), liveAd("2", "OUTCOME_TRAFFIC")], paging: { next: "next", cursors: { after: "page2" } } }))
      .mockResolvedValueOnce(json({ data: [liveAd("3", "LEAD_GENERATION")] }));

    const ads = await new GraphProvider("v22.0", fetcher).liveLeadAds("123", "secret");

    const first = new URL(fetcher.mock.calls[0][0]);
    expect(first.pathname).toBe("/v22.0/act_123/ads");
    expect(JSON.parse(first.searchParams.get("effective_status")!)).toEqual(["ACTIVE"]);
    expect(first.searchParams.get("fields")).toBe("id,name,effective_status,adset{id,name},campaign{id,name,objective}");
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("after")).toBe("page2");
    expect(ads).toEqual([
      { adId: "1", adName: "Объявление 1", adSet: { externalId: "110", name: "Группа 1" }, campaign: { externalId: "210", name: "Кампания 1" } },
      { adId: "3", adName: "Объявление 3", adSet: { externalId: "130", name: "Группа 3" }, campaign: { externalId: "230", name: "Кампания 3" } },
    ]);
  });

  it("refuses an ad listing that does not name its ad set and campaign", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ data: [{ id: "1", name: "Без группы", effective_status: "ACTIVE", campaign: { id: "210", name: "K", objective: "OUTCOME_LEADS" } }] }));

    await expect(new GraphProvider("v22.0", fetcher).liveLeadAds("123", "secret")).rejects.toMatchObject({ code: "INVALID_DATA" });
  });
});

describe("reading an ad's leads", () => {
  it("asks for leads created after a moment, follows cursors and maps them onto incoming leads", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json({ data: [metaLead("901")], paging: { next: "next", cursors: { after: "more" } } }))
      .mockResolvedValueOnce(json({ data: [metaLead("902", { field_data: [{ name: "email", values: ["b@example.com"] }] })] }));

    const leads = await new GraphProvider("v22.0", fetcher).leads("123", polled, new Date("2026-09-10T09:50:00Z"), "secret");

    const first = new URL(fetcher.mock.calls[0][0]);
    expect(first.pathname).toBe("/v22.0/555/leads");
    expect(first.searchParams.get("fields")).toBe("id,created_time,ad_id,form_id,field_data");
    expect(JSON.parse(first.searchParams.get("filtering")!)).toEqual([{ field: "time_created", operator: "GREATER_THAN", value: 1789033800 }]);
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("after")).toBe("more");
    expect(leads).toEqual([
      {
        externalId: "901", name: "Анна Петрова", company: null, phone: "+375291234567", email: null,
        source: {
          accountId: "123", formId: "777",
          campaign: { externalId: "c1", name: "Весна" }, adSet: { externalId: "s1", name: "Москва" }, ad: { externalId: "555", name: "Видео 1" },
          submittedAt: new Date("2026-09-10T10:00:00Z"),
          answers: [{ question: "full_name", values: ["Анна Петрова"] }, { question: "phone_number", values: ["+375291234567"] }],
          answersOmitted: false,
        },
      },
      expect.objectContaining({ externalId: "902", name: "b@example.com", email: "b@example.com" }),
    ]);
  });

  it.each([
    ["a lead without an identifier", metaLead("901", { id: undefined })],
    ["an unreadable submission time", metaLead("901", { created_time: "yesterday" })],
    ["answers that are not lists of strings", metaLead("901", { field_data: [{ name: "full_name", values: "Анна" }] })],
    ["a lead of another ad", metaLead("901", { ad_id: "999" })],
  ])("refuses %s", async (_label, row) => {
    const fetcher = vi.fn().mockResolvedValue(json({ data: [row] }));

    await expect(new GraphProvider("v22.0", fetcher).leads("123", polled, new Date(), "secret")).rejects.toMatchObject({ code: "INVALID_DATA" });
  });

  it.each([
    [190, 400, "TOKEN"], [102, 400, "TOKEN"],
    [10, 403, "ACCESS"], [200, 403, "ACCESS"], [283, 403, "ACCESS"], [299, 403, "ACCESS"],
    [4, 400, "PROVIDER"], [17, 400, "PROVIDER"], [32, 400, "PROVIDER"], [613, 400, "PROVIDER"], [80004, 400, "PROVIDER"],
    [1, 500, "PROVIDER"], [100, 400, "INVALID_DATA"],
  ])("classifies Graph error %i with HTTP %i as %s for lead reads", async (code, status, expected) => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { code, message: "Requires leads_retrieval for Анна +375291234567", type: "OAuthException" } }, status));

    const failure = await new GraphProvider("v22.0", fetcher).leads("123", polled, new Date(), "secret").catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: expected });
    expect(JSON.stringify(failure)).not.toMatch(/Анна|375291234567|leads_retrieval/);
    expect((failure as { detail: string }).detail).not.toMatch(/Анна|375291234567|leads_retrieval/);
  });

  it("honours Retry-After on a throttled lead read", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { code: 4 } }, 429, { "retry-after": "120" }));

    await expect(new GraphProvider("v22.0", fetcher).leads("123", polled, new Date(), "secret"))
      .rejects.toMatchObject({ code: "PROVIDER", retryAfterMs: 120_000 });
  });

  it("keeps treating a permission refusal on advertising reads as a token problem", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { code: 10 } }, 403));

    await expect(new GraphProvider("v22.0", fetcher).account("123", "secret")).rejects.toMatchObject({ code: "TOKEN" });
  });
});
