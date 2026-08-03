/**
 * Mirrors the server's `z.email()`: a local part, an `@`, and a dotted domain.
 * Kept deliberately stricter than the browser's `type="email"`, which accepts
 * `buyer@acme` and would let the request fail server-side instead.
 */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return emailPattern.test(value);
}

/**
 * Digits with at most one decimal point. Matches part-way input (`""`, `"12."`)
 * so it can gate a controlled field on every keystroke.
 */
const partialDecimalPattern = /^\d*\.?\d*$/;

export function isPartialDecimal(value: string): boolean {
  return partialDecimalPattern.test(value);
}
