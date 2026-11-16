import { leadsWord, nearestIndex, type Point } from "./chart";

const REPORT_EVERY_MS = 2800;
const SYNC_EVERY_MS = 1700;

function whenSeen(root: HTMLElement, seen: () => void): void {
  if (!("IntersectionObserver" in window)) {
    seen();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      seen();
    },
    { threshold: 0.15 },
  );
  observer.observe(root);
}

function mountFlow(root: HTMLElement): void {
  root.dataset.moving = "";
  const counter = root.querySelector<SVGTextElement>("[data-ib-report]");
  const sheet = root.querySelector<SVGGElement>("[data-ib-sheet]");
  for (const motion of root.querySelectorAll<SVGAnimateMotionElement>("[data-ib-flow] animateMotion")) {
    motion.beginElement();
  }
  let reports = Number(counter?.dataset.ibReport ?? 0);
  window.setInterval(() => {
    reports += 1;
    if (counter) counter.textContent = `ОТЧЁТ №${reports}`;
    sheet?.classList.remove("ib-sheet-new");
    void sheet?.getBoundingClientRect();
    sheet?.classList.add("ib-sheet-new");
  }, REPORT_EVERY_MS);
}

function mountHub(root: HTMLElement, moving: boolean): void {
  const tools = [...root.querySelectorAll<SVGGElement>("[data-ib-tool]")];
  const status = root.querySelector<SVGTextElement>("[data-ib-status]");
  const idle = status?.textContent ?? "";
  const connected = tools.filter((tool) => tool.dataset.ibTool === "connected");
  let hovered: SVGGElement | null = null;
  let turn = 0;

  const show = (active: SVGGElement | null) => {
    for (const tool of tools) {
      const on = tool === active;
      tool.toggleAttribute("data-on", on);
      root.querySelector(`[data-ib-path="${tool.dataset.ibName}"]`)?.toggleAttribute("data-on", on);
    }
    if (!status) return;
    status.textContent = active
      ? active.dataset.ibTool === "connected"
        ? `синхронизация · ${active.dataset.ibName}`
        : `${active.dataset.ibName} · скоро`
      : idle;
  };

  for (const tool of tools) {
    const enter = () => { hovered = tool; show(tool); };
    const leave = () => { hovered = null; show(moving ? connected[turn] ?? null : null); };
    tool.addEventListener("pointerenter", enter);
    tool.addEventListener("pointerleave", leave);
    tool.addEventListener("focus", enter);
    tool.addEventListener("blur", leave);
  }

  if (!moving || connected.length === 0) return;
  show(connected[0]);
  window.setInterval(() => {
    if (hovered) return;
    turn = (turn + 1) % connected.length;
    show(connected[turn]);
  }, SYNC_EVERY_MS);
}

function mountChart(root: HTMLElement): void {
  const chart = root.querySelector<SVGSVGElement>("[data-ib-chart]");
  if (!chart) return;
  const points = JSON.parse(chart.dataset.points ?? "[]") as Point[];
  const values = JSON.parse(chart.dataset.values ?? "[]") as number[];
  const days = JSON.parse(chart.dataset.days ?? "[]") as string[];
  const width = Number(chart.dataset.width);
  const marker = chart.querySelector<SVGCircleElement>("[data-ib-marker]");
  const guide = chart.querySelector<SVGLineElement>("[data-ib-guide]");
  const tip = chart.querySelector<SVGGElement>("[data-ib-tip]");
  const tipText = chart.querySelector<SVGTextElement>("[data-ib-tip-text]");
  const xs = points.map(([x]) => x);

  const show = (index: number, pointing: boolean) => {
    const [x, y] = points[index];
    marker?.setAttribute("cx", String(x));
    marker?.setAttribute("cy", String(y));
    guide?.setAttribute("x1", String(x));
    guide?.setAttribute("x2", String(x));
    guide?.toggleAttribute("data-on", pointing);
    const tipX = Math.min(width - 44, Math.max(44, x));
    tip?.setAttribute("transform", `translate(${tipX},${y < 34 ? y + 22 : y - 12})`);
    if (tipText) tipText.textContent = `${days[index]} · ${values[index]} ${leadsWord(values[index])}`;
  };

  chart.addEventListener("pointermove", (event) => {
    const box = chart.getBoundingClientRect();
    show(nearestIndex(xs, ((event.clientX - box.left) / box.width) * width), true);
  });
  chart.addEventListener("pointerleave", () => show(points.length - 1, false));
}

export function mountIntegrations(root: HTMLElement): void {
  const moving = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  mountChart(root);
  if (moving) root.dataset.in = "false";
  whenSeen(root, () => {
    root.dataset.in = "true";
    mountHub(root, moving);
    if (moving) mountFlow(root);
  });
}
