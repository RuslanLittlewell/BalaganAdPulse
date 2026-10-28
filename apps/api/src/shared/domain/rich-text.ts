export interface RichTextParts {
  readonly nodes: readonly string[];
  readonly marks: readonly string[];
}

export const STARTER_NODES = [
  "doc", "paragraph", "text", "heading", "blockquote", "bulletList", "orderedList", "listItem",
  "codeBlock", "horizontalRule", "hardBreak",
] as const;

export const STARTER_MARKS = ["bold", "italic", "strike", "code"] as const;

export const MAX_RICH_TEXT_DEPTH = 100;

const NODE_KEYS = new Set(["type", "content", "attrs", "marks", "text"]);
const MARK_KEYS = new Set(["type", "attrs"]);
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const INVISIBLE = /[\u0000-\u0020\u007f-\u00a0\u1680\u180e\u2000-\u200f\u2028\u2029\u205f\u3000\ufeff]/;

type Fields = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isPlain = (value: unknown) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

export function isSafeHref(href: unknown): boolean {
  if (typeof href !== "string" || INVISIBLE.test(href)) return false;
  const scheme = SCHEME.exec(href)?.[1]?.toLowerCase();
  return scheme === undefined || SAFE_SCHEMES.has(scheme);
}

function attrsProblem(attrs: unknown): string | null {
  if (attrs === undefined) return null;
  if (!isRecord(attrs)) return "Rich-text attributes must be an object";
  return Object.values(attrs).every(isPlain) ? null : "A rich-text attribute must be a plain value";
}

function markProblem(mark: unknown, parts: RichTextParts): string | null {
  if (!isRecord(mark) || typeof mark.type !== "string" || !parts.marks.includes(mark.type)) {
    return "Rich text may not carry this kind of formatting";
  }
  if (Object.keys(mark).some((key) => !MARK_KEYS.has(key))) return "A rich-text mark carries an unknown field";
  const problem = attrsProblem(mark.attrs);
  if (problem) return problem;
  if (mark.type === "link" && !isSafeHref(isRecord(mark.attrs) ? mark.attrs.href : undefined)) {
    return "A link may point only to a web, mail or phone address";
  }
  return null;
}

function nodeProblem(node: unknown, parts: RichTextParts, depth: number): string | null {
  if (depth > MAX_RICH_TEXT_DEPTH) return "Rich text is nested too deeply";
  if (!isRecord(node) || typeof node.type !== "string" || !parts.nodes.includes(node.type)) {
    return "Rich text may not hold this kind of part";
  }
  if ((depth === 0) !== (node.type === "doc")) return "Rich text is a single doc at its root";
  if (Object.keys(node).some((key) => !NODE_KEYS.has(key))) return "A rich-text part carries an unknown field";
  if (node.type === "text" ? typeof node.text !== "string" : node.text !== undefined) {
    return "Only a text part carries text";
  }
  const problem = attrsProblem(node.attrs);
  if (problem) return problem;
  if (node.marks !== undefined) {
    if (!Array.isArray(node.marks)) return "Rich-text marks must be a list";
    for (const mark of node.marks) {
      const marked = markProblem(mark, parts);
      if (marked) return marked;
    }
  }
  if (node.content === undefined) return null;
  if (!Array.isArray(node.content)) return "Rich-text content must be a list";
  for (const child of node.content) {
    const nested = nodeProblem(child, parts, depth + 1);
    if (nested) return nested;
  }
  return null;
}

export function richTextProblem(value: unknown, parts: RichTextParts): string | null {
  return nodeProblem(value, parts, 0);
}
