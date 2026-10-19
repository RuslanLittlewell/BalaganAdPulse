export interface LocalMoment {
  readonly date: string;
  readonly weekday: string;
  readonly time: string;
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
