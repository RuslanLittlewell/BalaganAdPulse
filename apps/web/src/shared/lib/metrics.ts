/**
 * Rendering measured figures.
 *
 * Every formatter takes `number | null` and answers a dash for the absent case,
 * because a ratio with no divisor is genuinely absent: no click was measured, so
 * there is no cost per click. Rendering it as `0` would claim the traffic was
 * free. The API sends `null` for exactly that, and it must survive to the screen.
 */

const MISSING = "—";

/** A non-breaking space: Russian grouping uses a space, and a figure must never
 * wrap across it. */
const NBSP = " ";

const grouped = (value: number, digits: number) =>
  value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace(/\s/g, NBSP);

/** True for a figure that can be rendered at all. `null` is the API's absent
 * marker; NaN and Infinity mean an arithmetic slip upstream, and printing
 * either would be worse than saying nothing. */
const present = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

/** The four currencies a budget can be stated in, and their signs. */
export const CURRENCY_SIGNS = { BYN: "Br", RUB: "₽", USD: "$", EUR: "€" } as const;

export type Currency = keyof typeof CURRENCY_SIGNS;

/**
 * Money, in the currency it is stated in.
 *
 * The default is the rouble because that is what this printed before there was
 * anything to choose — the metric screens show ad spend, which is a separate
 * question from what a client agreed to spend a month, and is unchanged.
 */
export function formatCurrency(value: number | null, currency: Currency = "RUB"): string {
  return present(value)
    ? `${grouped(Math.round(value), 0)}${NBSP}${CURRENCY_SIGNS[currency]}`
    : MISSING;
}

export function formatCount(value: number | null): string {
  return present(value) ? grouped(Math.round(value), 0) : MISSING;
}

/** For a narrow column: 1 284 500 becomes "1,28 млн". */
export function formatCompactCount(value: number | null): string {
  if (!present(value)) return MISSING;
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${grouped(value / 1_000_000, 2)}${NBSP}млн`;
  if (magnitude >= 10_000) return `${grouped(value / 1000, 1)}${NBSP}тыс.`;
  return grouped(Math.round(value), 0);
}

/** Already a percentage when it arrives — the API multiplies by 100. */
export function formatPercent(value: number | null): string {
  return present(value) ? `${grouped(value, 2)}%` : MISSING;
}

/** A cost per something: CPC, CPM, CPA. Two decimals, because a cost per click
 * is often under a rouble. */
export function formatRatio(value: number | null): string {
  return present(value) ? `${grouped(value, 2)}${NBSP}₽` : MISSING;
}

/** ROAS and frequency: a multiple, not a currency. */
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

/**
 * The series laid out inside the box, scaled to its own extremes.
 *
 * A flat series has no range to scale by. It is drawn through the middle rather
 * than along the bottom: a steady, high figure is not the same picture as
 * nothing at all, and dividing by a zero range would place it at either edge by
 * accident.
 */
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

/** An open polyline through the series. A single point becomes a flat line, so
 * one measured day still draws something. */
export function linePath(values: readonly number[], box: ChartBox): string {
  const drawn = points(values, box);
  if (drawn.length === 0) return "";
  if (drawn.length === 1) return `M0,${round(drawn[0].y)} L${round(box.width)},${round(drawn[0].y)}`;
  return `M${at(drawn[0])} ${drawn.slice(1).map((point) => `L${at(point)}`).join(" ")}`;
}

/** The same line, closed down to the baseline so it can be filled. */
export function areaPath(values: readonly number[], box: ChartBox): string {
  const line = linePath(values, box);
  if (line === "") return "";
  return `${line} L${round(box.width)},${round(box.height)} L0,${round(box.height)} Z`;
}
