export function localDate(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nextMorning(now: Date): Date {
  const today = localDate(now, "Europe/Warsaw");
  const morning = (date: string) => {
    const probe = new Date(`${date}T08:00:00Z`);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hourCycle: "h23" }).format(probe));
    return new Date(probe.getTime() - (hour - 8) * 3_600_000);
  };
  const candidate = morning(today);
  return candidate > now ? candidate : morning(shiftDate(today, 1));
}
