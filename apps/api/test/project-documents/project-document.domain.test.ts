import { describe, expect, it } from "vitest";
import { EXCERPT_LENGTH, excerptOf } from "../../src/modules/project-documents/domain/project-document.js";

const text = (value: string) => ({ type: "text", text: value });
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("a document's excerpt", () => {
  it("gives each paragraph, heading and list item a line of its own, in document order", () => {
    expect(excerptOf(doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Коротко")] },
      { type: "paragraph", content: [text("Почти все агентства "), { ...text("строят"), marks: [{ type: "bold" }] }, text(" анализ")] },
      { type: "bulletList", content: [
        { type: "listItem", content: [{ type: "paragraph", content: [text("Meta Ads")] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [text("Google Ads")] }] },
      ] },
    ))).toBe("Коротко\nПочти все агентства строят анализ\nMeta Ads\nGoogle Ads");
  });

  it("turns line breaks and runs of spaces into single spaces and skips empty paragraphs", () => {
    expect(excerptOf(doc(
      { type: "paragraph" },
      { type: "paragraph", content: [text("Первая"), { type: "hardBreak" }, text("вторая   строка")] },
      { type: "paragraph", content: [text("   ")] },
    ))).toBe("Первая вторая строка");
  });

  it("stops at its length and ends a cut text in an ellipsis", () => {
    const excerpt = excerptOf(doc(...Array.from({ length: 40 }, (_, index) =>
      ({ type: "paragraph", content: [text(`Абзац номер ${index} с текстом.`)] }))));

    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_LENGTH + 1);
    expect(excerpt.startsWith("Абзац номер 0 с текстом.\nАбзац номер 1")).toBe(true);
  });

  it("is empty for no text, and for anything that is not a document", () => {
    expect(excerptOf(null)).toBe("");
    expect(excerptOf(doc())).toBe("");
    expect(excerptOf([text("x")])).toBe("");
    expect(excerptOf({ type: "doc", content: "x" })).toBe("");
    expect(excerptOf(doc(null, 3, [text("x")], { type: "paragraph", content: [text("ok")] }))).toBe("ok");
  });

  it("walks a deeply nested document without running out of stack", () => {
    let nested: unknown = { type: "paragraph", content: [text("глубоко")] };
    for (let depth = 0; depth < 100_000; depth += 1) nested = { type: "blockquote", content: [nested] };

    expect(excerptOf(doc(nested))).toBe("глубоко");
  });
});
