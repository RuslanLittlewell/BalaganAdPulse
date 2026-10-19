export interface LocalMoment {
  readonly date: string;
  readonly weekday: string;
  readonly time: string;
}

export interface CalendarDay {
  readonly date: string;
  readonly weekday: string;
}

export const CALENDAR_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" });

export function calendarFrom(date: string, days = CALENDAR_DAYS): CalendarDay[] {
  const start = Date.parse(`${date}T00:00:00Z`);
  return Array.from({ length: days }, (_, offset) => {
    const day = new Date(start + offset * DAY_MS);
    return { date: day.toISOString().slice(0, 10), weekday: WEEKDAY.format(day) };
  });
}

export function localMoment(now: Date, timeZone: string): LocalMoment {
  const part = (options: Intl.DateTimeFormatOptions, locale = "en-CA") =>
    new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(now);
  return {
    date: part({ year: "numeric", month: "2-digit", day: "2-digit" }),
    weekday: part({ weekday: "long" }, "ru-RU"),
    time: part({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}
