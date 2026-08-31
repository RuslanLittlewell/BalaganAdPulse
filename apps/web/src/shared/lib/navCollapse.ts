const STORAGE_KEY = "adpulse.nav.collapsed";

/** Whether the navigation was left collapsed. Survives a reload the way the
 * theme does — a chosen layout that resets on every visit is not a choice. */
export function readNavCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // Private modes can refuse storage; the default width is a fine answer.
    return false;
  }
}

export function writeNavCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Not being able to remember it must not stop it from happening.
  }
}
