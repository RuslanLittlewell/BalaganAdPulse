export const MAX_TITLE_LENGTH = 120;
export const MAX_CONTENT_BYTES = 1_000_000;
export const EXCERPT_LENGTH = 280;

export interface DocumentAuthor {
  readonly id: string;
  readonly name: string;
}

export interface DocumentSummary {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly updatedBy: DocumentAuthor | null;
  readonly excerpt: string;
}

export interface ProjectDocument extends DocumentSummary {
  readonly content: unknown | null;
  readonly createdBy: DocumentAuthor | null;
}

export interface DocumentChange {
  readonly title?: string;
  readonly content?: unknown | null;
}

export function isRichText(content: unknown): boolean {
  return content !== null
    && typeof content === "object"
    && !Array.isArray(content)
    && (content as Record<string, unknown>).type === "doc";
}

export function fitsContent(content: unknown): boolean {
  return Buffer.byteLength(JSON.stringify(content), "utf8") <= MAX_CONTENT_BYTES;
}

type Node = Record<string, unknown>;

const childrenOf = (node: unknown): Node[] => {
  const content = (node as Node).content;
  return Array.isArray(content)
    ? content.filter((child): child is Node => child !== null && typeof child === "object" && !Array.isArray(child))
    : [];
};

const isInline = (node: Node) => node.type === "text" || node.type === "hardBreak";

export function excerptOf(content: unknown): string {
  if (!isRichText(content)) return "";
  const lines: string[] = [];
  let length = 0;
  const pending: unknown[] = [content];
  while (pending.length > 0 && length < EXCERPT_LENGTH) {
    const children = childrenOf(pending.pop());
    if (children.some(isInline)) {
      const line = children
        .map((child) => (typeof child.text === "string" ? child.text : " "))
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (line) {
        lines.push(line);
        length += line.length + 1;
      }
      continue;
    }
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]);
  }
  const excerpt = lines.join("\n");
  return excerpt.length > EXCERPT_LENGTH ? `${excerpt.slice(0, EXCERPT_LENGTH).trimEnd()}…` : excerpt;
}
