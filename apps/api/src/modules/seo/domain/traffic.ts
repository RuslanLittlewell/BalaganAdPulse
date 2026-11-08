import { shiftDate } from "./search.js";

export const TRAFFIC_DAYS = 90;
export const TRAFFIC_REFRESH_DAYS = 3;
export const PAIRS_PER_DAY = 200;
export const SOURCES_SHOWN = 100;

export interface TrafficRow {
  readonly date: string;
  readonly channel: string;
  readonly source: string;
  readonly medium: string;
  readonly sessions: number;
}

export interface TrafficSnapshot {
  readonly from: string;
  readonly to: string;
  readonly rows: readonly TrafficRow[];
}

export interface PropertyChoice {
  readonly propertyId: string;
  readonly name: string;
}

export interface ChannelTotal {
  readonly channel: string;
  readonly sessions: number;
}

export interface SourceTotal {
  readonly source: string;
  readonly medium: string;
  readonly sessions: number;
}

export interface DayTotal {
  readonly date: string;
  readonly sessions: number;
}

export function trafficWindow(today: string, firstImport: boolean): { from: string; to: string } {
  const to = shiftDate(today, -1);
  return { from: shiftDate(to, -((firstImport ? TRAFFIC_DAYS : TRAFFIC_REFRESH_DAYS) - 1)), to };
}

export function cappedPerDay(rows: readonly TrafficRow[]): TrafficRow[] {
  const byDay = new Map<string, TrafficRow[]>();
  for (const row of rows) byDay.set(row.date, [...(byDay.get(row.date) ?? []), row]);
  return [...byDay.values()].flatMap((day) => [...day].sort((a, b) => b.sessions - a.sessions).slice(0, PAIRS_PER_DAY));
}

export function shareOf(sessions: number, total: number): number {
  return total > 0 ? Number((sessions / total).toFixed(4)) : 0;
}
