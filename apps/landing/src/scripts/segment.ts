const DILATE_MS = 190;
const HANDOFF_MS = 150;
const LAND_MS = 300;
const RELAX_MS = 160;
const SQUASH = 3;
const INSET = 3;
const THUMB_RADIUS = 7;

type Slot = { start: number; end: number };
type Edge = "start" | "end";
type Tween = { from: number; to: number; start: number; duration: number; done?: () => void };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export interface Segment {
  move(index: number, animated: boolean): void;
}

export function mountSegment(track: HTMLElement, buttons: HTMLButtonElement[], initial: number): Segment {
  const thumb = document.createElement("div");
  thumb.setAttribute("aria-hidden", "true");
  thumb.className = "segment-thumb";
  for (const button of buttons) {
    const copy = document.createElement("span");
    copy.className = "segment-copy";
    for (const node of button.childNodes) copy.appendChild(node.cloneNode(true));
    thumb.appendChild(copy);
  }
  track.appendChild(thumb);

  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const edges = { start: 0, end: 0 };
  const tweens: Partial<Record<Edge, Tween>> = {};
  let slots: Slot[] = [];
  let current = initial;
  let frame = 0;
  let handoff = 0;
  let vertical = false;

  const paint = () => {
    const size = (vertical ? track.clientHeight : track.clientWidth) - INSET * 2;
    const start = Math.max(0, edges.start);
    const end = Math.max(0, size - edges.end);
    thumb.style.clipPath = vertical
      ? `inset(${start}px 0 ${end}px 0 round ${THUMB_RADIUS}px)`
      : `inset(0 ${end}px 0 ${start}px round ${THUMB_RADIUS}px)`;
  };

  const tick = (now: number) => {
    for (const edge of ["start", "end"] as const) {
      const tween = tweens[edge];
      if (!tween) continue;
      const progress = Math.min(1, (now - tween.start) / tween.duration);
      edges[edge] = tween.from + (tween.to - tween.from) * easeOut(progress);
      if (progress === 1) {
        delete tweens[edge];
        tween.done?.();
      }
    }
    paint();
    frame = tweens.start || tweens.end ? requestAnimationFrame(tick) : 0;
  };

  const tween = (edge: Edge, to: number, duration: number, done?: () => void) => {
    tweens[edge] = { from: edges[edge], to, start: performance.now(), duration, done };
    if (frame === 0) frame = requestAnimationFrame(tick);
  };

  const jump = (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    window.clearTimeout(handoff);
    delete tweens.start;
    delete tweens.end;
    edges.start = slot.start;
    edges.end = slot.end;
    paint();
  };

  const measure = () => {
    vertical = getComputedStyle(track).gridAutoFlow === "row";
    track.setAttribute("aria-orientation", vertical ? "vertical" : "horizontal");
    const box = track.getBoundingClientRect();
    slots = buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return vertical
        ? { start: rect.top - box.top - INSET, end: rect.bottom - box.top - INSET }
        : { start: rect.left - box.left - INSET, end: rect.right - box.left - INSET };
    });
    jump(current);
  };

  const travel = (from: number, to: number) => {
    const a = slots[from];
    const b = slots[to];
    if (!a || !b) return;
    window.clearTimeout(handoff);
    tween("start", Math.min(a.start, b.start), DILATE_MS);
    tween("end", Math.max(a.end, b.end), DILATE_MS);
    handoff = window.setTimeout(() => {
      const forward = b.start > a.start;
      const lead: Edge = forward ? "end" : "start";
      const trail: Edge = forward ? "start" : "end";
      tween(lead, b[lead], LAND_MS);
      tween(trail, b[trail] + (forward ? SQUASH : -SQUASH), LAND_MS, () => tween(trail, b[trail], RELAX_MS));
    }, HANDOFF_MS);
  };

  new ResizeObserver(measure).observe(track);
  document.fonts?.ready.then(measure);
  measure();

  return {
    move(index, animated) {
      const from = current;
      current = index;
      if (animated && !still.matches && from !== index) travel(from, index);
      else jump(index);
    },
  };
}
