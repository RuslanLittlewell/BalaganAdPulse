import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "adpulse.theme";

function storedTheme(): Theme | null {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function getPreferredTheme(): Theme {
  const saved = storedTheme();
  if (saved) return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export function initializeTheme(): void {
  applyTheme(getPreferredTheme());
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function onThemeChange(notify: () => void): () => void {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(onThemeChange, currentTheme, () => "light");
}

