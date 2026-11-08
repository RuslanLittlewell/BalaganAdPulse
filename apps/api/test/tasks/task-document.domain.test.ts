import { describe, expect, it } from "vitest";
import {
  assertRoomForDocuments, assertUploadableDocument, isPdf, MAX_DOCUMENTS_PER_TASK, MAX_TASK_DOCUMENT_BYTES, safeDocumentName,
} from "../../src/modules/tasks/domain/document.js";

describe("recognizing a PDF", () => {
  it("accepts a file that starts with the PDF header", () => {
    expect(isPdf(Buffer.from("%PDF-1.7\n..."))).toBe(true);
  });

  it("accepts a header a little way in, as the format allows", () => {
    expect(isPdf(Buffer.concat([Buffer.alloc(200), Buffer.from("%PDF-1.4")]))).toBe(true);
  });

  it("refuses a header beyond the first kilobyte", () => {
    expect(isPdf(Buffer.concat([Buffer.alloc(2000), Buffer.from("%PDF-1.4")]))).toBe(false);
  });

  it("refuses other files, however they are named", () => {
    expect(isPdf(Buffer.from("PK\u0003\u0004 a zip pretending"))).toBe(false);
    expect(isPdf(Buffer.alloc(0))).toBe(false);
  });
});

describe("the upload limits", () => {
  it("accepts a PDF of the allowed size", () => {
    expect(() => assertUploadableDocument(Buffer.from("%PDF-1.7 small"))).not.toThrow();
  });

  it("refuses a PDF over 20 MB", () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(MAX_TASK_DOCUMENT_BYTES)]);
    expect(() => assertUploadableDocument(big)).toThrow(/too large/);
  });

  it("refuses a file that is not a PDF", () => {
    expect(() => assertUploadableDocument(Buffer.from("hello"))).toThrow(/Only PDF/);
  });

  it("holds at most ten documents per task", () => {
    expect(() => assertRoomForDocuments(MAX_DOCUMENTS_PER_TASK - 1, 1)).not.toThrow();
    expect(() => assertRoomForDocuments(MAX_DOCUMENTS_PER_TASK, 1)).toThrow(/at most 10/);
  });
});

describe("a document's name", () => {
  it("keeps an ordinary name, Cyrillic included", () => {
    expect(safeDocumentName("Бриф клиента.pdf")).toBe("Бриф клиента.pdf");
  });

  it("removes path separators and control characters", () => {
    expect(safeDocumentName("..\\..\\etc/passwd\u0000.pdf")).not.toMatch(/[\\/\u0000]/);
  });

  it("falls back to a plain name when nothing is left", () => {
    expect(safeDocumentName(undefined)).toBe("document.pdf");
    expect(safeDocumentName("   ")).toBe("document.pdf");
  });

  it("clips a very long name", () => {
    expect(safeDocumentName(`${"a".repeat(500)}.pdf`).length).toBeLessThanOrEqual(200);
  });
});
