export const AMOUNT = /^\d{1,14}(\.\d{1,4})?$/;
export const NAME_LIMIT = 100;

export const decimal = (text: string) => text.trim().replace(",", ".");
export const shown = (amount: string) => String(Number(amount));
