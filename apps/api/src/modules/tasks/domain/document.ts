import { AppError } from "#shared/domain/index.js";

export const MAX_TASK_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_TASK = 10;
export const TASK_DOCUMENT_TYPE = "application/pdf";

const HEADER = "%PDF-";
const HEADER_WINDOW = 1024;
const NAME_LIMIT = 200;
const FALLBACK_NAME = "document.pdf";

export function isPdf(bytes: Buffer): boolean {
  return bytes.subarray(0, HEADER_WINDOW).includes(HEADER, 0, "latin1");
}

export function assertUploadableDocument(bytes: Buffer): void {
  if (bytes.length > MAX_TASK_DOCUMENT_BYTES) {
    throw new AppError("validation", "Document is too large; the limit is 20 MB");
  }
  if (!isPdf(bytes)) throw new AppError("validation", "Only PDF documents can be uploaded");
}

export function safeDocumentName(name: string | undefined): string {
  const cleaned = (name ?? "")
    .replace(/[\\/\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const clipped = cleaned.length > NAME_LIMIT ? cleaned.slice(0, NAME_LIMIT).trim() : cleaned;
  if (!clipped || clipped === ".pdf") return FALLBACK_NAME;
  return clipped;
}

export function assertRoomForDocuments(held: number, added: number): void {
  if (held + added > MAX_DOCUMENTS_PER_TASK) {
    throw new AppError("validation", `A task holds at most ${MAX_DOCUMENTS_PER_TASK} documents`);
  }
}
