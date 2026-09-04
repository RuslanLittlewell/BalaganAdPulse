const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return emailPattern.test(value);
}

const partialDecimalPattern = /^\d*\.?\d*$/;

export function isPartialDecimal(value: string): boolean {
  return partialDecimalPattern.test(value);
}
