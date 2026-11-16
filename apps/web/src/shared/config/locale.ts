export type Locale = "ru" | "en";

const STORAGE_KEY = "adpulse.language";

export function getLocale(): Locale {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ru";
  } catch {
    return "ru";
  }
}

export function getIntlLocale(): string {
  return getLocale() === "en" ? "en-US" : "ru-RU";
}

export function initializeLocale(): void {
  document.documentElement.lang = getLocale();
}

export function saveLocale(locale: Locale): boolean {
  const changed = getLocale() !== locale;
  localStorage.setItem(STORAGE_KEY, locale);
  initializeLocale();
  return changed;
}

export function reloadForLocale(): void {
  window.location.reload();
}
