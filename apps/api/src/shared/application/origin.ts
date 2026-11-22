export function isForeignOrigin(origin: string | undefined, host: string | undefined, appOrigin: string | null): boolean {
  if (origin === undefined) return false;
  if (appOrigin !== null && origin === appOrigin) return false;
  if (!URL.canParse(origin)) return true;
  return !host || new URL(origin).host !== host.toLowerCase();
}
