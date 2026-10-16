export const MAX_TITLE_LENGTH = 120;
export const MAX_CONTENT_BYTES = 1_000_000;

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
