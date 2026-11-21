import { describe, expect, it, vi } from "vitest";
import { Bitrix24RestClient, classifyBitrix24Error } from "../../src/modules/bitrix24/infrastructure/bitrix24-rest-client.js";
import { parseWebhookAddress } from "../../src/modules/bitrix24/domain/webhook-address.js";
import { parseWebhookEvent } from "../../src/modules/bitrix24/domain/event.js";
import { leadToRemote, parseRemoteLead, parseRemoteTask } from "../../src/modules/bitrix24/domain/records.js";

const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("the REST client", () => {
  it("posts JSON to the method under the webhook address and returns the result", async () => {
    const fetch = respond(200, { result: 42, time: {} });
    const client = new Bitrix24RestClient("https://acme.bitrix24.ru/rest/1/abc/", { fetch, minIntervalMs: 0 });

    expect(await client.call("crm.lead.add", { fields: { TITLE: "A" } })).toBe(42);
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://acme.bitrix24.ru/rest/1/abc/crm.lead.add.json");
    expect(init).toMatchObject({ method: "POST", redirect: "error", body: JSON.stringify({ fields: { TITLE: "A" } }) });
  });

  it("returns a page and the next offset of a list", async () => {
    const client = new Bitrix24RestClient("https://acme.bitrix24.ru/rest/1/abc/", { fetch: respond(200, { result: [{ ID: "1" }], next: 50 }), minIntervalMs: 0 });

    expect(await client.list("crm.lead.list")).toEqual({ items: [{ ID: "1" }], next: 50 });
  });

  it("refuses a host that is not public before sending anything", async () => {
    const fetch = respond(200, { result: true });
    const client = new Bitrix24RestClient("https://acme.bitrix24.ru/rest/1/abc/", { fetch, minIntervalMs: 0, isPublicHost: async () => false });

    await expect(client.call("profile")).rejects.toMatchObject({ kind: "REFUSED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("treats a network failure as transient", async () => {
    const client = new Bitrix24RestClient("https://acme.bitrix24.ru/rest/1/abc/", { fetch: vi.fn(async () => { throw new TypeError("fetch failed"); }), minIntervalMs: 0 });

    await expect(client.call("profile")).rejects.toMatchObject({ kind: "TRANSIENT" });
  });

  it.each([
    ["QUERY_LIMIT_EXCEEDED", "Too many requests", 503, "RATE"],
    ["INVALID_CREDENTIALS", "Invalid request credentials", 401, "AUTH"],
    ["expired_token", "", 401, "AUTH"],
    ["", "Not found", 400, "NOT_FOUND"],
    ["INTERNAL_SERVER_ERROR", "", 500, "TRANSIENT"],
    ["ERROR_CORE", "TITLE is required", 400, "REFUSED"],
  ])("classifies %s %s (%i) as %s", (code, description, status, kind) => {
    expect(classifyBitrix24Error(code, description, status).kind).toBe(kind);
  });
});

describe("webhook addresses", () => {
  it("accepts a REST webhook and normalizes it", () => {
    expect(parseWebhookAddress(" https://Acme.bitrix24.ru/rest/1/abc123 ")).toEqual({ base: "https://acme.bitrix24.ru/rest/1/abc123/", host: "acme.bitrix24.ru" });
  });

  it.each([
    "http://acme.bitrix24.ru/rest/1/abc/",
    "https://user:pass@acme.bitrix24.ru/rest/1/abc/",
    "https://127.0.0.1/rest/1/abc/",
    "https://localhost/rest/1/abc/",
    "https://acme.bitrix24.ru/rest/abc/",
    "https://acme.bitrix24.ru/rest/1/abc/?x=1",
    "not a url",
  ])("refuses %s", (raw) => {
    expect(parseWebhookAddress(raw)).toBeNull();
  });
});

describe("webhook events", () => {
  it("reads the token, the kind and the id", () => {
    expect(parseWebhookEvent({ event: "ONCRMLEADADD", data: { FIELDS: { ID: "7" } }, auth: { application_token: "t" } }))
      .toEqual({ token: "t", kind: "LEAD", remoteId: "7" });
  });

  it("ignores an event it does not sync", () => {
    expect(parseWebhookEvent({ event: "ONCRMDEALADD", data: { FIELDS: { ID: "7" } }, auth: { application_token: "t" } }))
      .toEqual({ token: "t", kind: null, remoteId: null });
  });
});

describe("record mapping", () => {
  it("reads a Bitrix24 lead", () => {
    expect(parseRemoteLead({ ID: 5, TITLE: "A", OPPORTUNITY: "0.00", CONTACT_ID: "0", COMPANY_ID: "9", DATE_MODIFY: "2026-11-20T10:00:00+03:00" }))
      .toMatchObject({ id: "5", title: "A", amount: null, contactId: null, companyId: "9", modifiedAt: new Date("2026-11-20T07:00:00Z") });
  });

  it("writes an AdPulse lead without empty links", () => {
    expect(leadToRemote({ name: "A", amount: "1500.0000", source: null, notes: null }, { statusId: null, contactId: null, companyId: null }))
      .toEqual({ TITLE: "A", OPPORTUNITY: "1500", SOURCE_DESCRIPTION: "", COMMENTS: "" });
  });

  it("reads a task bound to a lead", () => {
    expect(parseRemoteTask({ id: "3", title: "Позвонить", status: "5", ufCrmTask: ["C_1", "L_12"], changedDate: "2026-11-20T10:00:00Z" }))
      .toMatchObject({ id: "3", done: true, leadRemoteId: "12" });
  });
});
