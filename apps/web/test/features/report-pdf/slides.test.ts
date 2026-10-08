import { buildDeck, panelTitleSize, toBlocks } from "@/features/report-pdf/index.js";
import type { Report } from "@/entities/report/index.js";

const report: Report = {
  id: "r8", projectId: "p1", month: "2026-08", status: "PUBLISHED", currency: "USD",
  spend: "3080.7700", leads: 95, costPerLead: "32.4292",
  previous: { month: "2026-07", spend: "3080.8500", leads: 69, costPerLead: "44.6500" },
  change: { leads: "0.3768", costPerLead: "-0.2737" },
  trend: [
    { month: "2026-07", spend: "3080.8500", leads: 69, costPerLead: "44.6500" },
    { month: "2026-08", spend: "3080.7700", leads: 95, costPerLead: "32.4292" },
  ],
  ads: [
    { adId: "a1", name: "Smart", spend: "738.5700", leads: 21, costPerLead: "35.1700" },
    { adId: "a2", name: "Tilt", spend: "601.2900", leads: 1, costPerLead: "601.2900" },
  ],
  messengerContacts: 12,
  hasCover: false,
  conclusions: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Выросли", marks: [{ type: "bold" }] }, { type: "text", text: " на 38%" }] }] },
  plan: null,
  publishedAt: null, createdAt: "", updatedAt: "",
};

const deck = (overrides: Partial<Report> = {}) =>
  buildDeck({ report: { ...report, ...overrides }, projectName: "окна", clientName: "AURORA", currency: "USD" });

describe("the PDF deck", () => {
  it("follows the template order and names the file like the agency's reports", () => {
    const built = deck();
    expect(built.fileName).toBe("Отчет AURORA _ Август 2026.pdf");
    expect(built.slides.map((slide) => slide.kind)).toEqual(["cover", "summary", "trends", "ad", "ad", "text"]);
    expect(built.slides[0]).toEqual({ kind: "cover", client: "AURORA", period: "август 2026", pictureKey: "a1" });
    expect(built.slides[1]).toMatchObject({
      direction: "Лидогенерация - окна",
      budgetNote: "реализованный рекламный бюджет за август",
      leads: "95 заявок",
      contacts: "+ 12 обращений в соц. сети",
    });
    expect(built.slides[3]).toMatchObject({ kind: "ad", adId: "a1", result: expect.stringMatching(/^21 заявка по 35,17/) });
    expect(built.slides[4]).toMatchObject({ result: expect.stringMatching(/^1 заявка по/) });
    expect(built.slides[5]).toMatchObject({ kind: "text", title: "ВЫВОДЫ ЗА МЕСЯЦ" });
  });

  it("drops the optional slides and lines that have nothing to show", () => {
    const built = deck({ conclusions: null, plan: null, ads: [], messengerContacts: null });
    expect(built.slides.map((slide) => slide.kind)).toEqual(["cover", "summary", "trends"]);
    expect(built.slides[0]).toMatchObject({ pictureKey: null });
    expect(built.slides[1]).toMatchObject({ contacts: null });
  });

  it("puts the uploaded cover picture on the cover before the first ad's", () => {
    expect(deck({ hasCover: true }).slides[0]).toMatchObject({ pictureKey: "cover" });
  });

  it("states the corrected lead count it is given", () => {
    const built = deck({ leads: 90, costPerLead: "34.2308" });
    expect(built.slides[1]).toMatchObject({ leads: "90 заявок", cost: expect.stringContaining("34,23") });
  });

  it("charts both trends with labelled months", () => {
    const trends = deck().slides[2];
    expect(trends).toMatchObject({
      kind: "trends",
      leads: [{ label: "69", value: 69, caption: "Июль" }, { label: "95", value: 95, caption: "Август" }],
    });
  });
});

describe("rich text for the PDF", () => {
  it("keeps paragraphs, marks, lists and line breaks", () => {
    expect(toBlocks({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Итог", marks: [{ type: "bold" }, { type: "italic" }] }, { type: "hardBreak" }, { type: "text", text: "дальше" }] },
        { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Лид-формы" }] }] }] },
      ],
    })).toEqual([
      { kind: "paragraph", runs: [{ text: "Итог", bold: true, italic: true }, { text: "\n", bold: false, italic: false }, { text: "дальше", bold: false, italic: false }] },
      { kind: "list", ordered: true, items: [[{ kind: "paragraph", runs: [{ text: "Лид-формы", bold: false, italic: false }] }]] },
    ]);
    expect(toBlocks(null)).toEqual([]);
  });
});

describe("dark panel titles", () => {
  it("shrink when their longest word would not fit, and stay large otherwise", () => {
    expect(panelTitleSize("ВЫВОДЫ ЗА МЕСЯЦ")).toBe(50);
    expect(panelTitleSize("ПЛАН РАБОТ НА СЛЕДУЮЩИЙ МЕСЯЦ")).toBeLessThan(50);
    expect(panelTitleSize("ПЛАН РАБОТ НА СЛЕДУЮЩИЙ МЕСЯЦ") * 9 * 0.62).toBeLessThanOrEqual(224);
  });
});
