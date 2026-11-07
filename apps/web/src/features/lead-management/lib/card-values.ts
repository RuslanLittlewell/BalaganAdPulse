export const NONE = "__none__";

const AMOUNT = /^\d{1,14}(\.\d{1,4})?$/;

export function normalizedAmount(entered: string): string {
  return entered.replace(/[\s ]/g, "").replace(",", ".");
}

export function isAmount(entered: string): boolean {
  const amount = normalizedAmount(entered);
  return amount === "" || AMOUNT.test(amount);
}
