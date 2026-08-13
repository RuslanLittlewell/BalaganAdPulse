import type { PropertyType } from "../../../../lib/format.js";

/** Mirrors the server's rule in `value.service.ts`, so invalid input never travels. */
const DECIMAL = /^-?\d+(\.\d+)?$/;

/** Raised when numeric input cannot be stored. Carries no copy: UI text lives in `en.ts`. */
export class InvalidValueError extends Error {}

/**
 * The text an input starts with. Values arrive padded to four decimals to preserve
 * precision (`1250.0000`), but the number a person edits is `1250`.
 */
export function toInputValue(value: string | null, type: PropertyType): string {
  if (value === null) return "";
  if (type === "TEXT" || !DECIMAL.test(value) || !value.includes(".")) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Raw input to what the API stores. An empty input clears the cell; a comma reads as
 * a decimal separator, the way a numpad offers it.
 */
export function normalizeInput(raw: string, type: PropertyType): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (type === "TEXT") return trimmed;

  const numeric = trimmed.replace(",", ".");
  if (!DECIMAL.test(numeric)) throw new InvalidValueError();
  return numeric;
}
