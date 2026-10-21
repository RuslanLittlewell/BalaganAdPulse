import { mountSegment, type Segment } from "./segment";

export function mountTabs(root: HTMLElement, onSelect?: (panel: HTMLElement) => void): void {
  const list = root.querySelector<HTMLElement>('[role="tablist"]');
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const panelOf = (tab: HTMLButtonElement) => root.querySelector<HTMLElement>(`#${tab.getAttribute("aria-controls")}`);
  if (!list || tabs.length === 0) return;

  let segment: Segment | null = null;

  const select = (chosen: HTMLButtonElement, focus = false, animated = false) => {
    for (const tab of tabs) {
      const active = tab === chosen;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = panelOf(tab);
      if (panel) panel.hidden = !active;
    }
    if (focus) chosen.focus();
    segment?.move(tabs.indexOf(chosen), animated);
    const panel = panelOf(chosen);
    if (panel && onSelect) onSelect(panel);
  };

  list.hidden = false;
  const initial = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ?? tabs[0];
  if (list.hasAttribute("data-segment")) segment = mountSegment(list, tabs, tabs.indexOf(initial));
  for (const tab of tabs) {
    const panel = panelOf(tab);
    if (panel) panel.hidden = tab !== initial;
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab, false, true));
    tab.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(tab);
      const last = tabs.length - 1;
      const vertical = list.getAttribute("aria-orientation") === "vertical";
      const next = {
        [vertical ? "ArrowDown" : "ArrowRight"]: Math.min(last, index + 1),
        [vertical ? "ArrowUp" : "ArrowLeft"]: Math.max(0, index - 1),
        Home: 0,
        End: last,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      if (next !== index) select(tabs[next], true);
    });
  }
}

export function replay(panel: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  panel.removeAttribute("data-play");
  void panel.offsetWidth;
  panel.setAttribute("data-play", "");
}
