export const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

const END_OF_DAY = "24:00";
const DAY_MS = 24 * 60 * 60 * 1000;

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((each) => each.type === type)?.value);
  const wallClock = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
  return wallClock - Math.floor(instant / 1000) * 1000;
}

export function deadlineOf(dueDate: string, dueTime: string | null, timeZone: string): Date {
  const [year, month, day] = dueDate.split("-").map(Number) as [number, number, number];
  const [hours, minutes] = (dueTime ?? END_OF_DAY).split(":").map(Number) as [number, number];
  const wallClock = Date.UTC(year, month - 1, day, hours, minutes);
  const guess = wallClock - zoneOffsetMs(wallClock, timeZone);
  return new Date(wallClock - zoneOffsetMs(guess, timeZone));
}

export function isDueSoon(deadline: Date, now: Date): boolean {
  const left = deadline.getTime() - now.getTime();
  return left > 0 && left <= DUE_SOON_WINDOW_MS;
}

export function dayIn(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
