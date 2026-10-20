import { format, isSameDay, isSameYear, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { t } from "@/shared/config/index.js";

export interface DayGroup<T> {
  readonly key: string;
  readonly label: string;
  readonly events: readonly T[];
}

export function dayLabel(day: Date, now: Date): string {
  if (isSameDay(day, now)) return t("activity.today");
  if (isSameDay(day, subDays(now, 1))) return t("activity.yesterday");
  return format(day, isSameYear(day, now) ? "d MMMM" : "d MMMM yyyy", { locale: ru });
}

export function groupByDay<T extends { readonly createdAt: string }>(events: readonly T[], now: Date): DayGroup<T>[] {
  const groups: { key: string; label: string; events: T[] }[] = [];
  for (const event of events) {
    const at = new Date(event.createdAt);
    const key = format(at, "yyyy-MM-dd");
    const last = groups.at(-1);
    if (last?.key === key) last.events.push(event);
    else groups.push({ key, label: dayLabel(at, now), events: [event] });
  }
  return groups;
}
