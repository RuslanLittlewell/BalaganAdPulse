import { expect, it, vi } from "vitest";
import { GraphProvider } from "../../src/modules/integrations/infrastructure/graph-provider.js";
import { AesCredentialCipher } from "../../src/modules/integrations/infrastructure/credential-cipher.js";
import { nextMorning } from "../../src/modules/integrations/application/schedule.js";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
it("uses the guide endpoint with exactly one act prefix and fixed-origin cursor pagination", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ data: [{ id: "1", name: "One", effective_status: "ACTIVE" }], paging: { next: "https://evil.invalid/?access_token=secret", cursors: { after: "next" } } })).mockResolvedValueOnce(json({ data: [] }));
  const provider = new GraphProvider("v22.0", fetcher);
  await provider.campaigns("123", "secret");
  const first = new URL(fetcher.mock.calls[0][0]);
  const second = new URL(fetcher.mock.calls[1][0]);
  expect(first.pathname).toBe("/v22.0/act_123/campaigns");
  expect(first.searchParams.has("access_token")).toBe(false);
  expect(second.origin).toBe("https://graph.facebook.com");
  expect(second.searchParams.get("after")).toBe("next");
  expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer secret" }, redirect: "error" });
});
it("requests daily Insights at each level and maps aggregate actions without double counting", async () => {
  const fetcher = vi.fn(async (url: URL) => {
    if (url.pathname.endsWith("/act_123")) return json({ account_id: "123", currency: "USD", timezone_name: "America/Los_Angeles" });
    if (url.pathname.endsWith("/insights")) return json({ data: [{ campaign_id: "1", adset_id: "2", ad_id: "3", date_start: "2026-09-06", spend: "1.2345", impressions: "10", reach: "8", clicks: "2", actions: [{ action_type: "lead", value: "2" }, { action_type: "onsite_conversion.lead_grouped", value: "2" }], action_values: [{ action_type: "purchase", value: "12.3456" }] }] });
    return json({ data: [] });
  });
  const provider = new GraphProvider("v22.0", fetcher);
  const data = await provider.snapshot("123", "secret", "USD", new Date("2026-09-08T01:00:00Z"));
  expect(data.from).toBe("2026-08-08");
  expect(data.to).toBe("2026-09-06");
  expect(data.campaignMetrics[0]).toMatchObject({ spend: "1.2345", conversions: 2, revenue: "12.3456" });
  const urls = fetcher.mock.calls.map(([url]) => url).filter((url) => url.pathname.endsWith("/insights"));
  expect(urls.map((url) => url.searchParams.get("level"))).toEqual(["campaign", "adset", "ad"]);
  expect(urls.every((url) => url.searchParams.get("time_increment") === "1")).toBe(true);
});
it("redacts provider errors, times out requests, and rejects currency mismatch and invalid statuses", async () => {
  const rejected = new GraphProvider("v22.0", vi.fn().mockResolvedValue(json({ error: { code: 190, message: "secret" } }, 400)));
  await expect(rejected.account("123", "secret")).rejects.toMatchObject({ code: "TOKEN", message: "Meta integration: TOKEN" });
  const timed = new GraphProvider("v22.0", vi.fn(async (_url, init) => { throw init.signal.reason ?? new Error("secret"); }));
  await expect(timed.account("123", "secret")).rejects.toMatchObject({ code: "PROVIDER" });
  const mismatch = new GraphProvider("v22.0", vi.fn().mockResolvedValue(json({ account_id: "123", currency: "USD", timezone_name: "UTC" })));
  await expect(mismatch.snapshot("123", "secret", "BYN", new Date())).rejects.toMatchObject({ code: "CURRENCY" });
  const invalid = new GraphProvider("v22.0", vi.fn().mockResolvedValue(json({ data: [{ id: "1", name: "One", effective_status: "UNKNOWN" }] })));
  await expect(invalid.campaigns("123", "secret")).rejects.toMatchObject({ code: "INVALID_DATA" });
});
it("binds encrypted credentials to a project and detects tampering", () => {
  const cipher = new AesCredentialCipher(Buffer.alloc(32, 3).toString("base64"));
  const encrypted = cipher.encrypt("secret", "one");
  expect(cipher.decrypt(encrypted, "one")).toBe("secret");
  expect(() => cipher.decrypt(encrypted, "two")).toThrow();
  expect(() => cipher.decrypt(encrypted + "corrupt", "one")).toThrow();
});
it("schedules Warsaw mornings across both DST changes", () => {
  expect(nextMorning(new Date("2026-03-28T07:00:00Z")).toISOString()).toBe("2026-03-29T06:00:00.000Z");
  expect(nextMorning(new Date("2026-10-24T06:00:00Z")).toISOString()).toBe("2026-10-25T07:00:00.000Z");
});
it("aborts a stalled provider request at its deadline", async () => {
  const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(new Error("secret")));
  }));
  await expect(new GraphProvider("v22.0", fetcher, 5).account("123", "secret")).rejects.toMatchObject({ code: "PROVIDER" });
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
it("rejects oversized pages, repeated cursors and incomplete later pages", async () => {
  const large = new GraphProvider("v22.0", vi.fn().mockResolvedValue(new Response("x".repeat(5_000_001))));
  await expect(large.account("123", "secret")).rejects.toMatchObject({ code: "INVALID_DATA" });
  const repeated = new GraphProvider("v22.0", vi.fn().mockImplementation(async () => json({ data: [], paging: { next: "https://graph.facebook.com/next", cursors: { after: "same" } } })));
  await expect(repeated.campaigns("123", "secret")).rejects.toMatchObject({ code: "INVALID_DATA" });
  const partial = new GraphProvider("v22.0", vi.fn().mockResolvedValueOnce(json({ data: [{ id: "1", name: "One", effective_status: "ACTIVE" }], paging: { next: "next", cursors: { after: "next" } } })).mockResolvedValueOnce(json({ error: { is_transient: true } }, 503)));
  await expect(partial.campaigns("123", "secret")).rejects.toMatchObject({ code: "PROVIDER" });
});
it("does not repeat campaign_id in campaign Insights fields accepted by Meta", async () => {
  const fetcher = vi.fn(async (url: URL) => {
    if (url.pathname.endsWith("/act_123")) return json({ account_id: "123", currency: "USD", timezone_name: "UTC" });
    const fields = (url.searchParams.get("fields") ?? "").split(",");
    if (new Set(fields).size !== fields.length) return json({ error: { code: 2500, message: "Field campaign_id specified more than once" } }, 400);
    return json({ data: [] });
  });
  await expect(new GraphProvider("v22.0", fetcher).snapshot("123", "synthetic-token", "USD", new Date("2026-09-08T12:00:00Z"))).resolves.toMatchObject({ campaignMetrics: [], adSetMetrics: [], adMetrics: [] });
  const insights = fetcher.mock.calls.map(([url]) => url).filter((url) => url.pathname.endsWith("/insights"));
  expect(insights).toHaveLength(3);
});
