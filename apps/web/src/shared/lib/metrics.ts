const MISSING = "—";

const NBSP = " ";

const grouped = (value: number, digits: number) =>
  value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace(/\s/g, NBSP);

const present = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

export const CURRENCY_SIGNS = { BYN: "Br", RUB: "₽", USD: "$", EUR: "€" } as const;

export type Currency = keyof typeof CURRENCY_SIGNS;

export function formatCurrency(value: number | null, currency: Currency = "RUB"): string {
  return present(value)
    ? `${grouped(Math.round(value), 0)}${NBSP}${CURRENCY_SIGNS[currency]}`
    : MISSING;
}

export function formatCount(value: number | null): string {
  return present(value) ? grouped(Math.round(value), 0) : MISSING;
}

export function formatCompactCount(value: number | null): string {
  if (!present(value)) return MISSING;
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${grouped(value / 1_000_000, 2)}${NBSP}млн`;
  if (magnitude >= 10_000) return `${grouped(value / 1000, 1)}${NBSP}тыс.`;
  return grouped(Math.round(value), 0);
}

export function formatPercent(value: number | null): string {
  return present(value) ? `${grouped(value, 2)}%` : MISSING;
}

export function formatRatio(value: number | null): string {
  return present(value) ? `${grouped(value, 2)}${NBSP}₽` : MISSING;
}

export function formatMultiple(value: number | null): string {
  return present(value) ? `${grouped(value, 2)}x` : MISSING;
}

export interface ChartBox {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

function points(values: readonly number[], box: ChartBox): Point[] {
  if (values.length === 0) return [];
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const range = highest - lowest;
  const step = values.length === 1 ? 0 : box.width / (values.length - 1);
  return values.map((value, index) => ({
    x: index * step,
    y: range === 0 ? box.height / 2 : box.height - ((value - lowest) / range) * box.height,
  }));
}

const round = (value: number) => Math.round(value * 100) / 100;
const at = ({ x, y }: Point) => `${round(x)},${round(y)}`;

export function linePath(values: readonly number[], box: ChartBox): string {
  const drawn = points(values, box);
  if (drawn.length === 0) return "";
  if (drawn.length === 1) return `M0,${round(drawn[0].y)} L${round(box.width)},${round(drawn[0].y)}`;
  return `M${at(drawn[0])} ${drawn.slice(1).map((point) => `L${at(point)}`).join(" ")}`;
}

export function areaPath(values: readonly number[], box: ChartBox): string {
  const line = linePath(values, box);
  if (line === "") return "";
  return `${line} L${round(box.width)},${round(box.height)} L0,${round(box.height)} Z`;
}
