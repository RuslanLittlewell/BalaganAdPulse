import { replay } from "./tabs";

export const HOLD = 0.35;
export const TAIL = 0.5;

export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotateY: number;
  readonly rotateX: number;
  readonly scale: number;
  readonly opacity: number;
}

export interface Position {
  readonly raw: number;
  readonly shown: number;
}

const FRONT: Pose = { x: 0, y: 0, z: 40, rotateY: -8, rotateX: 5, scale: 1, opacity: 1 };
const AHEAD: Pose = { x: 72, y: 6, z: -520, rotateY: -35, rotateX: 12, scale: 0.74, opacity: 0 };
const BEHIND: Pose = { x: -78, y: 6, z: -520, rotateY: 35, rotateX: 12, scale: 0.74, opacity: 0 };
const FANNED = 4;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const mixNumber = (from: number, to: number, amount: number) => from + (to - from) * amount;

export function mix(from: Pose, to: Pose, amount: number): Pose {
  return {
    x: mixNumber(from.x, to.x, amount),
    y: mixNumber(from.y, to.y, amount),
    z: mixNumber(from.z, to.z, amount),
    rotateY: mixNumber(from.rotateY, to.rotateY, amount),
    rotateX: mixNumber(from.rotateX, to.rotateX, amount),
    scale: mixNumber(from.scale, to.scale, amount),
    opacity: mixNumber(from.opacity, to.opacity, amount),
  };
}

export function positionAt(progress: number, count: number): Position {
  const raw = -1 + clamp(progress) * (count + TAIL);
  const held = Math.min(raw, count - 1);
  const whole = Math.floor(held);
  const moving = clamp((held - whole - HOLD) / (1 - HOLD));
  return { raw, shown: whole + easeInOut(moving) };
}

export function progressFor(index: number, count: number): number {
  return (index + 1 + HOLD / 2) / (count + TAIL);
}

export function fanPose(index: number): Pose {
  return {
    x: -6 + index * 16,
    y: -index * 4,
    z: -index * 140,
    rotateY: -24,
    rotateX: 8,
    scale: 0.9,
    opacity: index < FANNED ? 1 - index * 0.2 : 0,
  };
}

export function chapterPose(offset: number): Pose {
  return offset <= 0 ? mix(FRONT, BEHIND, Math.min(1, -offset)) : mix(FRONT, AHEAD, Math.min(1, offset));
}

export function poseOf(index: number, shown: number): Pose {
  if (shown >= 0) return chapterPose(index - shown);
  return mix(fanPose(index), chapterPose(index), shown + 1);
}

export function copyOpacity(index: number, shown: number): number {
  return clamp(1 - Math.abs(index - shown) * 2.5);
}

export function introOpacity(shown: number): number {
  return clamp(1 - (shown + 1) * 2.5);
}

export function fillOf(index: number, raw: number, count: number): number {
  const span = index === count - 1 ? TAIL : 1;
  return clamp((raw - index) / span);
}

export function currentOf(shown: number, count: number): number {
  return Math.round(clamp(shown, -1, count - 1));
}

const transformOf = (pose: Pose, fit: number) =>
  `perspective(1600px) translate3d(${pose.x}%, ${pose.y}%, ${pose.z}px) rotateY(${pose.rotateY}deg) rotateX(${pose.rotateX}deg) scale(${pose.scale * fit})`;

const WIDE_WITH_MOTION = "(min-width: 64rem) and (prefers-reduced-motion: no-preference)";

export function mountDeck(root: HTMLElement): void {
  const modules = [...root.querySelectorAll<HTMLElement>("[data-deck-module]")];
  const panels = modules.map((module) => module.querySelector<HTMLElement>("[data-deck-panel]")!);
  const copies = modules.map((module) => module.querySelector<HTMLElement>("[data-deck-copy]")!);
  const intro = root.querySelector<HTMLElement>("[data-deck-intro]");
  const frame = root.querySelector<HTMLElement>("[data-deck-frame]");
  const nav = root.querySelector<HTMLElement>("[data-deck-nav]");
  const steps = [...root.querySelectorAll<HTMLButtonElement>("[data-deck-step]")];
  const fills = steps.map((step) => step.querySelector<HTMLElement>("[data-deck-fill]"));
  const count = modules.length;
  const wide = window.matchMedia(WIDE_WITH_MOTION);
  if (count === 0 || !frame || !nav) return;

  let mounted = false;
  let frameRequest = 0;
  let current: number | null = null;
  const played = new Set<HTMLElement>();

  const distance = () => root.offsetHeight - window.innerHeight;

  const fit = () => {
    const tallest = Math.max(...panels.map((panel) => panel.offsetHeight));
    return tallest === 0 ? 1 : Math.min(1, (frame.clientHeight * 0.92) / tallest);
  };

  const render = () => {
    frameRequest = 0;
    const travel = distance();
    const progress = travel <= 0 ? 0 : -root.getBoundingClientRect().top / travel;
    const { raw, shown } = positionAt(progress, count);
    const scale = fit();

    panels.forEach((panel, index) => {
      const pose = poseOf(index, shown);
      panel.style.transform = transformOf(pose, scale);
      panel.style.opacity = String(pose.opacity);
      panel.style.zIndex = String(100 - Math.round(Math.abs(index - Math.max(shown, 0)) * 10));
    });
    copies.forEach((copy, index) => {
      const opacity = copyOpacity(index, shown);
      copy.style.opacity = String(opacity);
      copy.style.transform = `translateY(${clamp((index - shown) * 32, -32, 32)}px)`;
    });
    if (intro) {
      intro.style.opacity = String(introOpacity(shown));
      intro.style.transform = `translateY(${-clamp(shown + 1) * 32}px)`;
    }
    fills.forEach((fill, index) => {
      if (fill) fill.style.transform = `scaleX(${fillOf(index, raw, count)})`;
    });

    const now = currentOf(shown, count);
    if (now === current) return;
    current = now;
    steps.forEach((step, index) => {
      if (index === now) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
    if (now >= 0) replay(panels[now]);
  };

  const schedule = () => {
    if (!frameRequest) frameRequest = window.requestAnimationFrame(render);
  };

  const jumpTo = (index: number) => {
    const top = root.getBoundingClientRect().top + window.scrollY + progressFor(index, count) * distance();
    window.scrollTo({ top, behavior: "smooth" });
  };

  steps.forEach((step, index) => step.addEventListener("click", () => jumpTo(index)));

  const mount = () => {
    if (mounted) return;
    mounted = true;
    current = null;
    root.setAttribute("data-deck", "");
    nav.hidden = false;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    render();
  };

  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    root.removeAttribute("data-deck");
    nav.hidden = true;
    for (const element of [...panels, ...copies, intro]) {
      element?.style.removeProperty("transform");
      element?.style.removeProperty("opacity");
      element?.style.removeProperty("z-index");
    }
  };

  const playOnSight = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const panel = entry.target as HTMLElement;
        if (!entry.isIntersecting || mounted || played.has(panel)) continue;
        played.add(panel);
        replay(panel);
      }
    },
    { threshold: 0.3 },
  );
  for (const panel of panels) playOnSight.observe(panel);

  const follow = () => (wide.matches ? mount() : unmount());
  wide.addEventListener("change", follow);
  follow();
}
