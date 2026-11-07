export function readableNumber(value: string | null): string {
  if (!value) return "";
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}

export function calendarDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

const COMPACT = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 });

export function compactSum(total: number): string {
  return COMPACT.format(total);
}
