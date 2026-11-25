import { describe, expect, it } from "vitest";
import { marquizLeadOf, marquizWebhookSchema } from "../../src/modules/leads/presentation/http/marquiz-webhook-schemas.js";

const submission = {
  raw: [{ q: "ab6c5412-5c7f-489d-8d79-173ce632930e", a: "3f0bb0ea-fc31-4b49-86b5-337ca0cf86da" }],
  answers: [
    { q: "How many windows do you need?*", a: "5+ windows" },
    { q: "Which rooms?", a: ["Kitchen", "Bedroom"] },
    { q: "Comment", a: "" },
  ],
  contacts: { name: " Karl Lauster ", email: "karl@example.com", phone: "+15125550181" },
  quiz: { id: "600920a2de60d9004900edb9", name: "Window price quiz" },
  created: "2026-11-24T10:23:25.796Z",
  extra: {
    href: "https://windowhub.pro/quiz",
    referrer: "https://l.facebook.com/",
    utm: { source: "facebook", medium: "cpc", campaign: "TOF | QUIZ | USA", content: "vid 1", term: "" },
    cookies: { _ga: "GA1.2.1" },
    ip: "203.0.113.5",
  },
  result: { id: "OBq5B3FYI6", title: "Result header", cost: "1500" },
};

const leadOf = (body: unknown) => {
  const parsed = marquizWebhookSchema.safeParse(body);
  return parsed.success ? marquizLeadOf(parsed.data) : null;
};

describe("a Marquiz submission", () => {
  it("becomes a website lead with its contacts, answers, quiz name, tags and page", () => {
    expect(leadOf(submission)).toEqual({
      externalId: expect.stringMatching(/^marquiz-[0-9a-f]{64}$/),
      name: "Karl Lauster",
      company: null,
      phone: "+15125550181",
      email: "karl@example.com",
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "TOF | QUIZ | USA",
      utmContent: "vid 1",
      utmTerm: null,
      pageUrl: "https://windowhub.pro/quiz",
      referrer: "https://l.facebook.com/",
      answers: [
        { question: "How many windows do you need?", values: ["5+ windows"] },
        { question: "Which rooms?", values: ["Kitchen", "Bedroom"] },
        { question: "Квиз", values: ["Window price quiz"] },
      ],
    });
  });

  it("has the same submission id when delivered again, and another id for another submission", () => {
    const first = leadOf(submission)!;
    expect(leadOf(structuredClone(submission))!.externalId).toBe(first.externalId);
    expect(leadOf({ ...submission, created: "2026-11-24T10:24:00.000Z" })!.externalId).not.toBe(first.externalId);
  });

  it("reads answers sent as an object of questions", () => {
    expect(leadOf({ contacts: { phone: "+1" }, answers: { "Budget*": "$5,000", Floors: 2 } })!.answers).toEqual([
      { question: "Budget", values: ["$5,000"] },
      { question: "Floors", values: ["2"] },
    ]);
  });

  it("takes the campaign from utm name when campaign is missing", () => {
    expect(leadOf({ contacts: { phone: "+1" }, extra: { utm: { name: "spring" } } })!.utmCampaign).toBe("spring");
  });

  it("cuts long values to the intake's lengths instead of refusing them", () => {
    const lead = leadOf({ contacts: { name: "N".repeat(300), phone: "1".repeat(80) }, answers: [{ q: "Q".repeat(250), a: "A".repeat(2500) }] })!;
    expect(lead.name).toHaveLength(200);
    expect(lead.phone).toHaveLength(50);
    expect(lead.answers[0].question).toHaveLength(200);
    expect(lead.answers[0].values[0]).toHaveLength(2000);
  });

  it("keeps at most fifty pairs, the quiz name among them", () => {
    const answers = Array.from({ length: 60 }, (_, index) => ({ q: `Question ${index}`, a: "yes" }));
    const lead = leadOf({ contacts: { phone: "+1" }, answers, quiz: { name: "Quiz" } })!;
    expect(lead.answers).toHaveLength(50);
    expect(lead.answers.at(-1)).toEqual({ question: "Квиз", values: ["Quiz"] });
  });

  it("is not a submission without contacts or answers", () => {
    expect(leadOf({ quiz: { name: "Quiz" }, extra: { href: "https://windowhub.pro" } })).toBeNull();
    expect(leadOf({ contacts: { name: " " }, answers: [{ q: "Question", a: "" }] })).toBeNull();
    expect(leadOf(["not", "an", "object"])).toBeNull();
  });
});
