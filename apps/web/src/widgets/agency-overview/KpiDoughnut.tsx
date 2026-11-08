import { useId, useState, type FocusEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { DateRange } from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";
import { formatDay } from "@/shared/lib/index.js";
import type { KpiCounts } from "./monthlyKpiStandings.js";

const CENTER = 50;
const OUTER = 45;
const INNER = 29;
const FULL = 99.99;

const PARTS = [
  { key: "met", label: "dashboard.kpi.met", color: "var(--kpi-neon-met)" },
  { key: "behind", label: "dashboard.kpi.behind", color: "var(--kpi-neon-behind)" },
  { key: "danger", label: "dashboard.kpi.danger", color: "var(--kpi-neon-danger)" },
  { key: "unrated", label: "dashboard.kpi.unrated", color: "var(--kpi-neon-none)" },
] as const;

export interface KpiDoughnutProps {
  range: DateRange;
  counts?: KpiCounts & { behindProjects?: readonly NamedProject[]; dangerProjects?: readonly NamedProject[]; unratedProjects?: readonly NamedProject[] };
}

type NamedProject = { id: string; name: string };
type Tipped = "behind" | "danger" | "unrated";

const LISTED = 10;
const POINTER_OFFSET = 14;

interface Anchor {
  readonly x: number;
  readonly y: number;
}

function GroupTip({ id, anchor, title, projects }: { id: string; anchor: Anchor; title: string; projects: readonly NamedProject[] }) {
  const rest = projects.length - LISTED;
  return createPortal(
    <div
      id={id}
      role="tooltip"
      style={{ position: "fixed", left: anchor.x + POINTER_OFFSET, top: anchor.y + POINTER_OFFSET }}
      className="pointer-events-none z-50 max-w-64 rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-md"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {projects.slice(0, LISTED).map((project) => (
          <li key={project.id} className="truncate">{project.name}</li>
        ))}
      </ul>
      {rest > 0 ? <p className="mt-1 text-muted-foreground">{t("dashboard.kpi.more")} {rest}</p> : null}
    </div>,
    document.body,
  );
}

function point(radius: number, percent: number): string {
  const angle = (percent / 100) * 2 * Math.PI;
  return `${(CENTER + radius * Math.sin(angle)).toFixed(3)} ${(CENTER - radius * Math.cos(angle)).toFixed(3)}`;
}

function circle(radius: number, sweep: 0 | 1): string {
  const top = `${CENTER} ${CENTER - radius}`;
  return `M ${top} A ${radius} ${radius} 0 1 ${sweep} ${CENTER} ${CENTER + radius} A ${radius} ${radius} 0 1 ${sweep} ${top} Z`;
}

function sector(start: number, length: number): string {
  if (length >= FULL) return `${circle(OUTER, 1)} ${circle(INNER, 0)}`;
  const end = start + length;
  const large = length > 50 ? 1 : 0;
  return `M ${point(OUTER, start)} A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)} L ${point(INNER, end)} A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)} Z`;
}

interface Hover {
  onPointerEnter?: (event: PointerEvent) => void;
  onPointerMove?: (event: PointerEvent) => void;
  onPointerLeave?: () => void;
}

function Segment({ start, length, color, part, glow = true, hover }: { start: number; length: number; color: string; part: string; glow?: boolean; hover?: Hover }) {
  if (length <= 0) return null;
  return (
    <path
      data-part={part}
      data-share={Math.round(length * 10) / 10}
      {...hover}
      d={sector(start, length)}
      fillRule="evenodd"
      strokeWidth={1.5}
      strokeLinejoin="round"
      style={{
        stroke: color,
        fill: `color-mix(in srgb, ${color} 22%, transparent)`,
        filter: glow ? `drop-shadow(0 0 var(--kpi-neon-glow) ${color})` : undefined,
      }}
    />
  );
}

export function KpiDoughnut({ range, counts }: KpiDoughnutProps) {
  const titleId = useId();
  const tipId = useId();
  const [tip, setTip] = useState<(Anchor & { part: Tipped }) | null>(null);
  const listed: Record<Tipped, readonly NamedProject[]> = {
    behind: counts?.behindProjects ?? [],
    danger: counts?.dangerProjects ?? [],
    unrated: counts?.unratedProjects ?? [],
  };
  const tippable = (key: string): key is Tipped => (key === "behind" || key === "danger" || key === "unrated") && listed[key].length > 0;
  const pointAt = (part: Tipped) => (event: PointerEvent) => setTip({ part, x: event.clientX, y: event.clientY });
  const focusAt = (part: Tipped) => (event: FocusEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setTip({ part, x: box.left + box.width / 2, y: box.top });
  };
  const hide = () => setTip(null);
  const total = counts ? counts.met + counts.behind + counts.danger + counts.unrated : 0;
  const shares = PARTS.map((part) => (counts && total > 0 ? (counts[part.key] / total) * 100 : 0));
  const starts = shares.map((_, index) => shares.slice(0, index).reduce((sum, share) => sum + share, 0));
  const label = counts
    ? `${t("dashboard.kpi.title")}: ${PARTS.map((part) => `${t(part.label)} ${counts[part.key]}`).join(", ")}`
    : t("dashboard.kpi.title");

  return (
    <section aria-labelledby={titleId} className="flex max-h-[340px] flex-col overflow-y-auto rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 id={titleId} className="text-sm font-semibold text-foreground">{t("dashboard.kpi.title")}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDay(range.from)} – {formatDay(range.to)}
        </span>
      </div>

      <div className="relative mx-auto mt-3 aspect-square w-full max-w-40">
        <svg viewBox="0 0 100 100" role="img" aria-label={label} className="size-full overflow-visible">
          {total === 0 ? <Segment start={0} length={100} color={PARTS[3].color} part="empty" glow={false} /> : null}
          {PARTS.map((part, index) => (
            <Segment key={part.key} start={starts[index]!} length={shares[index]!} color={part.color} part={part.key} glow={part.key !== "unrated"} hover={tippable(part.key) ? { onPointerEnter: pointAt(part.key), onPointerMove: pointAt(part.key), onPointerLeave: hide } : undefined} />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-base font-semibold tabular-nums text-foreground">
            {counts && total > 0 ? `${counts.met} ${t("dashboard.kpi.outOf")} ${total}` : "—"}
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {PARTS.map((part) => (
          <li
            key={part.key}
            className="flex items-center gap-2 rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...(tippable(part.key)
              ? {
                  tabIndex: 0,
                  "aria-describedby": tip?.part === part.key ? tipId : undefined,
                  onFocus: focusAt(part.key),
                  onBlur: hide,
                  onPointerEnter: pointAt(part.key),
                  onPointerMove: pointAt(part.key),
                  onPointerLeave: hide,
                }
              : {})}
          >
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: part.color, boxShadow: part.key === "unrated" ? undefined : `0 0 6px ${part.color}` }} />
            <span className="flex-1 text-muted-foreground">{t(part.label)}</span>
            <span className="font-medium tabular-nums text-foreground">{counts ? counts[part.key] : "—"}</span>
          </li>
        ))}
      </ul>
      {tip ? <GroupTip id={tipId} anchor={tip} title={t(`dashboard.kpi.${tip.part}`)} projects={listed[tip.part]} /> : null}
    </section>
  );
}
