import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { MetaConversionsApi, conversionsBody } from "../../src/modules/conversions/infrastructure/meta-conversions-api.js";
import { ConversionsApiError, outgoingEvent, type OutgoingEvent } from "../../src/modules/conversions/domain/conversions.js";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

const sale: OutgoingEvent = outgoingEvent({
  id: "6f1c0d3e-0000-4000-8000-000000000001",
  leadId: "4b9a2c1d-0000-4000-8000-000000000002",
  eventName: "Продажа",
  reachedAt: new Date("2026-11-12T08:05:00Z"),
  carriesAmount: true,
  metaLeadId: "12345678901234567",
  phoneDigits: "375291234567",
  email: " Ivan@Mail.ru ",
  amount: "1200.0000",
}, "BYN");

const replying = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("Conversions API body", () => {
  it("carries the event, the hashed identifiers and the amount of a sale", () => {
    const body = JSON.parse(conversionsBody([sale], null));
    expect(body).toEqual({
      data: [{
        event_name: "Продажа",
        event_time: Math.floor(Date.parse("2026-11-12T08:05:00Z") / 1000),
        action_source: "system_generated",
        event_id: sale.id,
        user_data: {
          external_id: [sha(sale.leadId)],
          lead_id: expect.any(Number),
          ph: [sha("375291234567")],
          em: [sha("ivan@mail.ru")],
        },
        custom_data: { event_source: "crm", lead_event_source: "AdPulse", value: 1200, currency: "BYN" },
      }],
    });
  });

  it("writes a 17-digit Meta lead ID into the JSON exactly as stored", () => {
    const text = conversionsBody([sale, { ...sale, id: "second", metaLeadId: "98765432109876543" }], null);
    expect(text).toContain('"lead_id":12345678901234567');
    expect(text).toContain('"lead_id":98765432109876543');
    expect(text).not.toContain("12345678901234568");
  });

  it("adds the test event code beside the data, and leaves out the value of an event without an amount", () => {
    const qual = outgoingEvent({
      id: "q", leadId: "l", eventName: "Квал", reachedAt: new Date("2026-11-12T08:00:00Z"), carriesAmount: false,
      metaLeadId: "1", phoneDigits: null, email: null, amount: "500.0000",
    }, "BYN");
    const body = JSON.parse(conversionsBody([qual], "TEST123"));
    expect(body.test_event_code).toBe("TEST123");
    expect(body.data[0].custom_data).toEqual({ event_source: "crm", lead_event_source: "AdPulse" });
    expect(body.data[0].user_data).toEqual({ external_id: [sha("l")], lead_id: 1 });
  });
});

describe("Meta Conversions API client", () => {
  it("posts events to the dataset with the token as a bearer", async () => {
    const fetcher = replying(200, { events_received: 1, fbtrace_id: "x" });
    await new MetaConversionsApi("v22.0", fetcher).send("1234567890", "secret-token", [sale], null);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://graph.facebook.com/v22.0/1234567890/events");
    expect(init).toMatchObject({ method: "POST", headers: { Authorization: "Bearer secret-token", "Content-Type": "application/json" } });
    expect(JSON.parse(init.body).data).toHaveLength(1);
  });

  it("reads the dataset's name to check a dataset ID and token", async () => {
    const fetcher = replying(200, { id: "1234567890", name: "Пиксель клиента" });
    expect(await new MetaConversionsApi("v22.0", fetcher).dataset("1234567890", "secret-token")).toEqual({ id: "1234567890", name: "Пиксель клиента" });
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://graph.facebook.com/v22.0/1234567890?fields=id%2Cname");
  });

  it.each([
    ["a revoked token", 400, { error: { code: 190, message: "Error validating access token" } }, "AUTH"],
    ["an unauthorized request", 401, { error: { message: "Unauthorized" } }, "AUTH"],
    ["an invalid parameter", 400, { error: { code: 100, message: "Invalid parameter", error_user_msg: "Неверное значение event_time" } }, "REFUSED"],
    ["a rate limit", 400, { error: { code: 613, message: "Calls limited" } }, "TEMPORARY"],
    ["a server error", 503, { error: { code: 2, message: "Service temporarily unavailable" } }, "TEMPORARY"],
    ["an unknown error", 400, { error: { code: 803, message: "Unknown" } }, "TEMPORARY"],
  ])("classifies %s", async (_label, status, body, kind) => {
    const failure = await new MetaConversionsApi("v22.0", replying(status, body)).send("1", "t", [sale], null).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConversionsApiError);
    expect((failure as ConversionsApiError).kind).toBe(kind);
  });

  it("keeps Meta's message for the user as the reason of a refusal", async () => {
    const failure = await new MetaConversionsApi("v22.0", replying(400, { error: { code: 100, message: "Invalid parameter", error_user_msg: "Неверное значение event_time" } }))
      .send("1", "t", [sale], null).catch((error: unknown) => error as ConversionsApiError);
    expect(failure.reason).toBe("Неверное значение event_time");
  });

  it("treats a network failure as temporary", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const failure = await new MetaConversionsApi("v22.0", fetcher).send("1", "t", [sale], null).catch((error: unknown) => error as ConversionsApiError);
    expect(failure.kind).toBe("TEMPORARY");
  });

  it("refuses a dataset Meta answers for with another ID", async () => {
    const failure = await new MetaConversionsApi("v22.0", replying(200, { id: "999", name: "Другой" })).dataset("1234567890", "t").catch((error: unknown) => error as ConversionsApiError);
    expect(failure.kind).toBe("REFUSED");
  });
});
