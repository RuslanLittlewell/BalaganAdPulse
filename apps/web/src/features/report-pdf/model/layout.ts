export const PANEL = { width: 296, left: 52, right: 20 } as const;

const WIDEST_LETTER = 0.62;
const LARGEST = 50;

export function panelTitleSize(title: string): number {
  const room = PANEL.width - PANEL.left - PANEL.right;
  const longest = Math.max(1, ...title.split(/\s+/).map((word) => word.length));
  return Math.min(LARGEST, Math.floor(room / (longest * WIDEST_LETTER)));
}
