import { describe, expect, it } from "vitest";
import {
  MAX_RICH_TEXT_DEPTH,
  STARTER_MARKS,
  STARTER_NODES,
  isSafeHref,
  richTextProblem,
} from "../../src/shared/domain/rich-text.js";

const parts = { nodes: [...STARTER_NODES, "taskImage"], marks: [...STARTER_MARKS, "link"] };

const doc = (...content: unknown[]) => ({ type: "doc", content });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const link = (href: unknown) => ({ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer", class: null } });

describe("rich text the editors make", () => {
  it("is accepted with headings, lists, quotes, code, marks, links and images", () => {
    const written = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("План")] },
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("Баннер", [{ type: "bold" }]))] }] },
      { type: "orderedList", attrs: { start: 1, type: null }, content: [{ type: "listItem", content: [paragraph(text("Шаг"))] }] },
      { type: "blockquote", content: [paragraph(text("Цитата", [{ type: "italic" }, { type: "strike" }]))] },
      { type: "codeBlock", attrs: { language: null }, content: [text("npm test")] },
      { type: "horizontalRule" },
      paragraph(text("Сайт", [link("https://acme.by")]), { type: "hardBreak" }, text("x", [{ type: "code" }])),
      { type: "taskImage", attrs: { imageId: "img-1" } },
      paragraph(),
    );

    expect(richTextProblem(written, parts)).toBeNull();
  });

  it("is accepted when it is an empty document", () => {
    expect(richTextProblem({ type: "doc" }, parts)).toBeNull();
  });
});

describe("rich text the editors do not make", () => {
  it.each([
    ["a part of an unknown type", doc({ type: "iframe", attrs: { src: "https://evil.test" } })],
    ["a root that is not a doc", paragraph(text("x"))],
    ["a doc inside a doc", doc(doc())],
    ["an unknown field", doc({ type: "paragraph", html: "<b>x</b>" })],
    ["an attribute holding an object", doc({ type: "heading", attrs: { level: { toString: "x" } } })],
    ["text outside a text part", doc({ type: "paragraph", text: "x" })],
    ["a text part without text", doc(paragraph({ type: "text" }))],
    ["an unknown mark", doc(paragraph(text("x", [{ type: "script" }])))],
    ["a mark with an unknown field", doc(paragraph(text("x", [{ type: "bold", onclick: "x" }])))],
    ["content that is not a list", doc({ type: "paragraph", content: "x" })],
    ["a string", "<p>x</p>"],
    ["a list", [doc()]],
  ])("refuses %s", (_label, value) => {
    expect(richTextProblem(value, parts)).not.toBeNull();
  });

  it("refuses formatting a field's editor does not offer", () => {
    const linked = doc(paragraph(text("x", [link("https://acme.by")])));
    expect(richTextProblem(linked, { nodes: STARTER_NODES, marks: STARTER_MARKS })).not.toBeNull();
    expect(richTextProblem(doc({ type: "taskImage", attrs: { imageId: "i" } }), { nodes: STARTER_NODES, marks: STARTER_MARKS })).not.toBeNull();
  });

  it("refuses a document nested deeper than the limit, without exhausting the stack", () => {
    let nested: unknown = paragraph(text("x"));
    for (let level = 0; level < MAX_RICH_TEXT_DEPTH + 5; level += 1) nested = { type: "blockquote", content: [nested] };
    expect(richTextProblem(doc(nested), parts)).toBe("Rich text is nested too deeply");

    let deep: unknown = [];
    for (let level = 0; level < 50_000; level += 1) deep = { type: "blockquote", content: [deep] };
    expect(richTextProblem(doc(deep), parts)).not.toBeNull();
  });
});

describe("a link's address", () => {
  it.each(["https://acme.by", "http://acme.by/a?b=1", "mailto:info@acme.by", "tel:+375291234567", "/projects/1", "#top", "acme.by"])(
    "allows %s", (href) => { expect(isSafeHref(href)).toBe(true); },
  );

  it.each([
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)",
    " javascript:alert(1)", "\u0000javascript:alert(1)", "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)", "file:///etc/passwd", "https://acme.by/ ", 42, null,
  ])("refuses %j", (href) => { expect(isSafeHref(href)).toBe(false); });
});
