import { describe, expect, it, vi } from "vitest";
import { GoogleAdsProvider, spendOf } from "../../src/modules/integrations/infrastructure/google-ads-provider.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const oauth = { accessToken: vi.fn(async () => "access") };
const settings = { apiVersion: "v24" };
const NOW = new Date("2026-09-08T01:00:00Z");

type Reply = unknown | ((query: string, url: string, init: RequestInit) => unknown);

function google(replies: { match: RegExp; reply: Reply }[], listed = ["customers/111"]) {
  const fetcher = vi.fn(async (input: URL | string, init: RequestInit) => {
    const url = String(input);
    if (url.endsWith("customers:listAccessibleCustomers")) return json({ resourceNames: listed });
    const query = JSON.parse(String(init.body ?? "{}")).query as string;
    const found = replies.find(({ match }) => match.test(query));
    if (!found) throw new Error(`unexpected query: ${query}`);
    const reply = typeof found.reply === "function" ? (found.reply as (...args: unknown[]) => unknown)(query, url, init) : found.reply;
    return reply instanceof Response ? reply : json(reply);
  });
  return { fetcher, provider: new GoogleAdsProvider(oauth, settings, fetcher as unknown as typeof fetch) };
}

const customer = (over: Record<string, string> = {}) => ({
  results: [{ customer: { id: "222", currencyCode: "USD", timeZone: "America/Los_Angeles", ...over } }],
});

describe("spend in millionths of the currency", () => {
  it.each([
    [12345678n, "12.3457"],
    [0n, "0.0000"],
    [49n, "0.0000"],
    [50n, "0.0001"],
    [1_000_000n, "1.0000"],
    [123_456_789_012_345n, "123456789.0123"],
  ])("reads %s as %s", (micros, expected) => {
    expect(spendOf(micros)).toBe(expected);
  });
});

describe("listing the accounts a sign-in reaches", () => {
  it("offers a directly reached account without a manager and a managed one through its manager", async () => {
    const { provider, fetcher } = google([
      {
        match: /FROM customer_client/,
        reply: (_query: string, url: string) => url.includes("customers/111/")
          ? { results: [
              { customerClient: { id: "111", descriptiveName: "Agency", manager: true, currencyCode: "USD", timeZone: "UTC" } },
              { customerClient: { id: "222", descriptiveName: "Shop", currencyCode: "USD", timeZone: "Europe/Warsaw" } },
              { customerClient: { id: "333", descriptiveName: "Blog", currencyCode: "EUR", timeZone: "UTC" } },
            ] }
          : { results: [] },
      },
    ]);

    const accounts = await provider.accounts("refresh");

    expect(accounts).toEqual([
      { accountId: "333", name: "Blog", currency: "EUR", timezone: "UTC", loginCustomerId: "111" },
      { accountId: "222", name: "Shop", currency: "USD", timezone: "Europe/Warsaw", loginCustomerId: "111" },
    ]);
    const headers = (fetcher.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(headers).toMatchObject({ Authorization: "Bearer access", "login-customer-id": "111" });
    expect(headers).not.toHaveProperty("developer-token");
  });

  it("reaches a lone account directly, with no manager to log in through", async () => {
    const { provider } = google([{
      match: /FROM customer_client/,
      reply: { results: [{ customerClient: { id: "111", descriptiveName: "", currencyCode: "USD", timeZone: "UTC" } }] },
    }]);
    expect(await provider.accounts("refresh")).toEqual([
      { accountId: "111", name: "111", currency: "USD", timezone: "UTC", loginCustomerId: null },
    ]);
  });

  it("skips an account Google will not let the sign-in read and keeps the rest", async () => {
    const { provider } = google([{
      match: /FROM customer_client/,
      reply: (_q: string, url: string) => url.includes("customers/111/")
        ? json({ error: { status: "PERMISSION_DENIED", details: [{ errors: [{ errorCode: { authorizationError: "CUSTOMER_NOT_ENABLED" } }] }] } }, 403)
        : { results: [{ customerClient: { id: "444", descriptiveName: "Ok", currencyCode: "USD", timeZone: "UTC" } }] },
    }], ["customers/111", "customers/444"]);
    expect((await provider.accounts("refresh")).map((account) => account.accountId)).toEqual(["444"]);
  });
});

describe("verifying one account", () => {
  it("returns its currency and time zone, asking through the version and manager it was given", async () => {
    const { provider, fetcher } = google([{ match: /FROM customer$/, reply: customer() }]);

    expect(await provider.account("222", "111", "refresh")).toEqual({ accountId: "222", currency: "USD", timezone: "America/Los_Angeles" });

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://googleads.googleapis.com/v24/customers/222/googleAds:search");
    expect(init).toMatchObject({ method: "POST", redirect: "error" });
    expect(init.headers).toMatchObject({ "login-customer-id": "111" });
    expect(init.headers).not.toHaveProperty("developer-token");
  });

  it("sends no manager header for an account reached directly", async () => {
    const { provider, fetcher } = google([{ match: /FROM customer$/, reply: customer() }]);
    await provider.account("222", null, "refresh");
    expect((fetcher.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty("login-customer-id");
  });

  it("refuses an answer about another account", async () => {
    const { provider } = google([{ match: /FROM customer$/, reply: customer({ id: "999" }) }]);
    await expect(provider.account("222", null, "refresh")).rejects.toMatchObject({ code: "INVALID_DATA" });
  });

  it("refuses an id that is not a customer number before asking Google anything", async () => {
    const { provider, fetcher } = google([]);
    await expect(provider.account("2/../3", null, "refresh")).rejects.toMatchObject({ code: "INVALID_DATA" });
    await expect(provider.account("222", "x", "refresh")).rejects.toMatchObject({ code: "INVALID_DATA" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("the daily snapshot", () => {
  const replies = (over: Partial<Record<string, unknown>> = {}) => [
    { match: /FROM customer$/, reply: customer() },
    { match: /FROM campaign WHERE campaign.status/, reply: over.campaigns ?? { results: [
      { campaign: { id: "1", name: "Search", status: "ENABLED", advertisingChannelType: "SEARCH" } },
      { campaign: { id: "2", name: "Old", status: "PAUSED" } },
    ] } },
    { match: /FROM ad_group WHERE ad_group.status/, reply: over.adGroups ?? { results: [
      { adGroup: { id: "10", name: "Group", status: "ENABLED" }, campaign: { id: "1" } },
    ] } },
    { match: /FROM ad_group_ad WHERE ad_group_ad.status/, reply: over.ads ?? { results: [
      { adGroupAd: { ad: { id: "100", name: "" }, status: "ENABLED" }, adGroup: { id: "10" } },
    ] } },
    { match: /FROM conversion_action WHERE/, reply: over.actions ?? { results: [
      { conversionAction: { category: "SUBMIT_LEAD_FORM" } },
      { conversionAction: { category: "PHONE_CALL_LEAD" } },
      { conversionAction: { category: "SUBMIT_LEAD_FORM" } },
    ] } },
    { match: /conversion_action_category, metrics.all_conversions FROM campaign WHERE/, reply: over.campaignResults ?? { results: [
      { campaign: { id: "1" }, segments: { date: "2026-09-06", conversionActionCategory: "CONTACT" }, metrics: { allConversions: 3.996603 } },
      { campaign: { id: "1" }, segments: { date: "2026-09-06", conversionActionCategory: "SUBMIT_LEAD_FORM" }, metrics: { allConversions: 2 } },
      { campaign: { id: "1" }, segments: { date: "2026-09-05", conversionActionCategory: "PURCHASE" }, metrics: { allConversions: 0 } },
    ] } },
    { match: /conversion_action_category, metrics.all_conversions FROM ad_group WHERE/, reply: over.adGroupResults ?? { results: [
      { adGroup: { id: "10" }, segments: { date: "2026-09-06", conversionActionCategory: "CONTACT" }, metrics: { allConversions: 1 } },
    ] } },
    { match: /conversion_action_category, metrics.all_conversions FROM ad_group_ad WHERE/, reply: over.adResults ?? { results: [] } },
    { match: /FROM campaign WHERE segments/, reply: over.campaignMetrics ?? { results: [
      { campaign: { id: "1" }, segments: { date: "2026-09-06" }, metrics: { costMicros: "12345678", impressions: "1000", clicks: "40", conversions: 2.4, allConversions: 5.996603, conversionsValue: 99.5 } },
    ] } },
    { match: /FROM ad_group WHERE segments/, reply: over.adGroupMetrics ?? { results: [
      { adGroup: { id: "10" }, segments: { date: "2026-09-06" }, metrics: { costMicros: "5000000" } },
    ] } },
    { match: /FROM ad_group_ad WHERE segments/, reply: over.adMetrics ?? { results: [] } },
  ];

  it("maps the hierarchy and the figures of the last thirty completed days in the account's time zone", async () => {
    const { provider, fetcher } = google(replies());

    const snapshot = await provider.snapshot({ accountId: "222", currency: "USD", loginCustomerId: "111" }, "refresh", NOW);

    expect(snapshot.from).toBe("2026-08-08");
    expect(snapshot.to).toBe("2026-09-06");
    expect(snapshot.campaigns).toEqual([
      { id: "1", name: "Search", status: "ACTIVE", objective: "SEARCH", conversionCategories: ["CONTACT", "PHONE_CALL_LEAD", "SUBMIT_LEAD_FORM"] },
      { id: "2", name: "Old", status: "PAUSED", objective: undefined, conversionCategories: ["PHONE_CALL_LEAD", "SUBMIT_LEAD_FORM"] },
    ]);
    expect(snapshot.adSets).toEqual([{ id: "10", name: "Group", status: "ACTIVE", parentId: "1" }]);
    expect(snapshot.ads).toEqual([{ id: "100", name: "Ad 100", status: "ACTIVE", parentId: "10" }]);
    expect(snapshot.campaignMetrics).toEqual([{
      externalId: "1", date: "2026-09-06", spend: "12.3457", impressions: 1000, reach: 0, clicks: 40,
      conversions: 2, results: 6, revenue: "99.5000",
    }]);
    expect(snapshot.campaignResults).toEqual([
      { externalId: "1", date: "2026-09-06", category: "CONTACT", results: "3.9966" },
      { externalId: "1", date: "2026-09-06", category: "SUBMIT_LEAD_FORM", results: "2.0000" },
    ]);
    expect(snapshot.adSetResults).toEqual([{ externalId: "10", date: "2026-09-06", category: "CONTACT", results: "1.0000" }]);
    expect(snapshot.adResults).toEqual([]);
    expect(snapshot.adSetMetrics[0]).toMatchObject({ externalId: "10", spend: "5.0000", impressions: 0, clicks: 0, conversions: 0, revenue: "0.0000" });
    const queries = fetcher.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)).query as string);
    expect(queries.filter((query) => query.includes("segments.date BETWEEN '2026-08-08' AND '2026-09-06'"))).toHaveLength(6);
    expect(queries).toContain("SELECT conversion_action.category FROM conversion_action WHERE conversion_action.status = 'ENABLED'");
    expect(queries.every((query) => !query.includes("REMOVED") || query.includes("!= 'REMOVED'"))).toBe(true);
  });

  it("follows every page of a long answer", async () => {
    let served = 0;
    const { provider } = google([
      ...replies({ campaigns: undefined }).filter(({ match }) => !/FROM campaign WHERE campaign.status/.test(match.source)),
      {
        match: /FROM campaign WHERE campaign.status/,
        reply: (_q: string, _u: string, init: RequestInit) => {
          const token = JSON.parse(String(init.body)).pageToken;
          served += 1;
          return token
            ? { results: [{ campaign: { id: "2", name: "Two", status: "PAUSED" } }] }
            : { results: [{ campaign: { id: "1", name: "One", status: "ENABLED" } }], nextPageToken: "page-2" };
        },
      },
    ]);

    const snapshot = await provider.snapshot({ accountId: "222", currency: "USD", loginCustomerId: null }, "refresh", NOW);

    expect(snapshot.campaigns.map((campaign) => campaign.id)).toEqual(["1", "2"]);
    expect(served).toBe(2);
  });

  it("refuses to import figures in another currency than the connection holds", async () => {
    const { provider } = google(replies());
    await expect(provider.snapshot({ accountId: "222", currency: "EUR", loginCustomerId: null }, "refresh", NOW))
      .rejects.toMatchObject({ code: "CURRENCY" });
  });

  it("publishes nothing when a row is malformed", async () => {
    const { provider } = google(replies({ campaigns: { results: [{ campaign: { id: "1", name: "x", status: "WEIRD" } }] } }));
    await expect(provider.snapshot({ accountId: "222", currency: "USD", loginCustomerId: null }, "refresh", NOW))
      .rejects.toMatchObject({ code: "INVALID_DATA" });
  });

  it("refuses a page token that repeats", async () => {
    const { provider } = google([
      { match: /FROM customer$/, reply: customer() },
      { match: /FROM campaign WHERE campaign.status/, reply: { results: [], nextPageToken: "same" } },
    ]);
    await expect(provider.snapshot({ accountId: "222", currency: "USD", loginCustomerId: null }, "refresh", NOW))
      .rejects.toMatchObject({ code: "INVALID_DATA" });
  });
});

describe("what Google's refusals mean", () => {
  const refuse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    google([{ match: /FROM customer$/, reply: new Response(JSON.stringify(body), { status, headers }) }]).provider.account("222", null, "refresh");

  it("takes a 401 as a sign-in that has to be renewed", async () => {
    await expect(refuse(401, { error: { status: "UNAUTHENTICATED" } })).rejects.toMatchObject({ code: "TOKEN" });
  });

  it.each(["USER_PERMISSION_DENIED", "DEVELOPER_TOKEN_NOT_APPROVED", "CUSTOMER_NOT_ENABLED"])(
    "takes %s as a lack of access",
    async (code) => {
      await expect(refuse(403, { error: { status: "PERMISSION_DENIED", details: [{ errors: [{ errorCode: { authorizationError: code } }] }] } }))
        .rejects.toMatchObject({ code: "ACCESS", detail: expect.stringContaining(code) });
    },
  );

  it("takes throttling as a reason to retry after the delay Google names", async () => {
    await expect(refuse(429, { error: { status: "RESOURCE_EXHAUSTED" } }, { "retry-after": "30" }))
      .rejects.toMatchObject({ code: "PROVIDER", retryAfterMs: 30_000 });
  });

  it("takes a server error as a reason to retry", async () => {
    await expect(refuse(503, {})).rejects.toMatchObject({ code: "PROVIDER" });
  });

  it("takes any other refusal as unusable data", async () => {
    await expect(refuse(400, { error: { status: "INVALID_ARGUMENT" } })).rejects.toMatchObject({ code: "INVALID_DATA" });
  });

  it("names Google, not Meta, in what it raises", async () => {
    await expect(refuse(401, {})).rejects.toMatchObject({ message: "Google integration: TOKEN" });
  });
});
