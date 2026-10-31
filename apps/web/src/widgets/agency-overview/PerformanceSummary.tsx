import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  closestCenter,
  defaultDropAnimation,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  getClientRect,
  MeasuringStrategy,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type ClientRect,
  type DropAnimation,
  type MeasuringConfiguration,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  cn,
  formatCount,
  formatCurrency,
  formatMultiple,
  formatPercent,
  formatRatio,
} from "@/shared/lib/index.js";
import type { Currency } from "@/shared/lib/index.js";
import {
  EMPTY_PERFORMANCE,
  type Performance,
  type CurrencyPerformance,
} from "@/entities/campaign/index.js";
import type { KpiFigures, KpiScope } from "@/entities/kpi/index.js";
import { KpiTile, type ProjectKpiPart } from "@/features/kpi-target/index.js";
import { t } from "@/shared/config/index.js";
import {
  AddTile,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  MetricCard,
  MoveHandle,
  RollingNumber,
  type MoveStep,
  type TileMove,
} from "@/shared/ui/index.js";
import {
  chosenTiles,
  dragStarted,
  draggedOver,
  MAX_SUMMARY_TILES,
  movedTo,
  sameOrder,
  SUMMARY_TILES,
  toggledTiles,
  type SummaryTile,
  type TileDrag,
} from "./summaryTiles.js";

export interface PerformanceSummaryProps {
  tiles: readonly SummaryTile[];
  onTilesChange?: (tiles: SummaryTile[]) => void;
  range: { from: string; to: string };
  performance?: Performance;
  currency?: Currency;
  currencyPerformances?: CurrencyPerformance[];
  kpi?: { scope: KpiScope; canEdit: boolean; part?: ProjectKpiPart; projectFigures?: KpiFigures };
}

const LABELS: Record<SummaryTile, string> = {
  SPEND: t("metric.spend"),
  IMPRESSIONS: t("metric.impressions"),
  CLICKS: t("metric.clicks"),
  CONVERSIONS: t("metric.conversions"),
  RESULTS: t("metric.results"),
  CPC: t("metric.cpc"),
  KPI: t("summary.kpi"),
};

const SILENT: Announcements = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

function measureCell(node: HTMLElement): ClientRect {
  if (getComputedStyle(node).display !== "contents" || node.children.length === 0) return getClientRect(node);
  const rects = Array.from(node.children, (child) => child.getBoundingClientRect());
  const top = Math.min(...rects.map((rect) => rect.top));
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { top, left, right, bottom, width: right - left, height: bottom - top };
}

const MEASURING: MeasuringConfiguration = {
  draggable: { measure: measureCell },
  droppable: { measure: measureCell, strategy: MeasuringStrategy.Always },
};

const DROP_ANIMATION: DropAnimation = {
  ...defaultDropAnimation,
  sideEffects: defaultDropAnimationSideEffects({ className: { active: "*:opacity-0" } }),
};

const placeOf = (tile: SummaryTile, order: readonly SummaryTile[]) =>
  `${LABELS[tile]}: ${t("summary.place")} ${order.indexOf(tile) + 1} ${t("summary.placeOf")} ${order.length}`;

function SummaryCell({
  tile,
  movable,
  group,
  children,
}: {
  tile: SummaryTile;
  movable: boolean;
  group: boolean;
  children: ReactNode;
}) {
  const drag = useDraggable({ id: tile, disabled: !movable });
  const drop = useDroppable({ id: tile, disabled: !movable });
  const startDrag = drag.listeners?.onPointerDown;

  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      onPointerDown={movable
        ? (event) => {
            if (event.currentTarget.contains(event.target as Node)) startDrag?.(event);
          }
        : undefined}
      data-testid={group ? undefined : "summary-tile"}
      data-tile={group ? undefined : tile}
      data-dragging={drag.isDragging ? "true" : undefined}
      className={group
        ? cn("contents data-[dragging=true]:*:opacity-40", movable && "*:cursor-grab")
        : cn("group/tile relative data-[dragging=true]:opacity-40", movable && "cursor-grab")}
    >
      {children}
    </div>
  );
}

export function PerformanceSummary({
  tiles,
  onTilesChange,
  range,
  performance,
  currency = "RUB",
  currencyPerformances,
  kpi,
}: PerformanceSummaryProps) {
  const groups = currencyPerformances?.length
    ? currencyPerformances
    : [{ currency, performance: performance ?? EMPTY_PERFORMANCE }];
  const figures = currencyPerformances
    ? groups.reduce(
        (total, group) => ({
          ...total,
          impressions: total.impressions + group.performance.impressions,
          reach: total.reach + group.performance.reach,
          clicks: total.clicks + group.performance.clicks,
          conversions: total.conversions + group.performance.conversions,
          results: total.results + group.performance.results,
        }),
        { ...EMPTY_PERFORMANCE },
      )
    : (performance ?? EMPTY_PERFORMANCE);
  if (currencyPerformances) {
    figures.ctr = figures.impressions
      ? (figures.clicks * 100) / figures.impressions
      : null;
    figures.frequency = figures.reach
      ? figures.impressions / figures.reach
      : null;
  }
  const monetary = (
    format: (p: Performance, currency: Currency) => ReactNode,
  ) => (
    <>
      {groups.map((group) => (
        <div key={group.currency ?? "unknown"}>
          {format(group.performance, group.currency)}
        </div>
      ))}
    </>
  );
  const [configuring, setConfiguring] = useState(false);
  const [drag, setDragState] = useState<TileDrag | null>(null);
  const [dropped, setDropped] = useState<{ order: SummaryTile[]; from: string } | null>(null);
  const dragRef = useRef<TileDrag | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const configurable = onTilesChange !== undefined;

  const offered = SUMMARY_TILES.filter(
    (tile) => tile !== "KPI" || kpi !== undefined,
  );
  const chosen = chosenTiles(tiles, offered);
  const atLimit = chosen.length >= MAX_SUMMARY_TILES;
  const orderKey = chosen.join(" ");
  const settled = dropped?.from === orderKey ? dropped.order : chosen;
  const shown = drag?.order ?? settled;
  const movable = configurable && chosen.length > 1;
  const kpiGroup = kpi?.scope.kind === "project";

  useLayoutEffect(() => setDropped(null), [orderKey]);

  const setDrag = (next: TileDrag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const tileOf = (id: UniqueIdentifier | undefined) =>
    chosen.find((tile) => tile === id) ?? null;
  const arrange = (next: SummaryTile[], tile: SummaryTile) => {
    setDropped({ order: next, from: orderKey });
    onTilesChange?.(next);
    setAnnouncement(placeOf(tile, next));
  };
  const step = (tile: SummaryTile, by: MoveStep) => {
    const next = movedTo(settled, tile, settled.indexOf(tile) + by);
    if (sameOrder(next, settled)) return;
    arrange(next, tile);
  };
  const moveOf = (tile: SummaryTile): TileMove => ({
    label: `${t("summary.move")}: ${LABELS[tile]}`,
    hint: t("summary.move.hint"),
    onStep: (by) => step(tile, by),
  });

  const render = (
    tile: SummaryTile,
    { preview = false, move }: { preview?: boolean; move?: TileMove } = {},
  ): ReactNode => {
    switch (tile) {
      case "SPEND":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.SPEND}
            value={monetary((p, c) => (
              <RollingNumber value={formatCurrency(p.spend, c)} />
            ))}
            hint={monetary(
              (p, c) => `${t("metric.cpm")} ${formatRatio(p.cpm, c)}`,
            )}
          />
        );
      case "IMPRESSIONS":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.IMPRESSIONS}
            value={formatCount(figures.impressions)}
            hint={`${t("metric.frequency")} ${formatMultiple(figures.frequency)}`}
          />
        );
      case "CLICKS":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.CLICKS}
            value={formatCount(figures.clicks)}
            hint={`${t("metric.ctr")} ${formatPercent(figures.ctr)}`}
          />
        );
      case "CONVERSIONS":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.CONVERSIONS}
            value={formatCount(figures.conversions)}
            hint={monetary(
              (p, c) => `${t("metric.cpa")} ${formatRatio(p.cpa, c)}`,
            )}
          />
        );
      case "RESULTS":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.RESULTS}
            value={formatCount(figures.results)}
            hint={monetary(
              (p, c) => `${t("metric.costPerResult")} ${formatRatio(p.costPerResult, c)}`,
            )}
          />
        );
      case "CPC":
        return (
          <MetricCard
            className="h-full"
            label={LABELS.CPC}
            value={monetary((p, c) => (
              <RollingNumber value={formatRatio(p.cpc, c)} />
            ))}
            hint={`${t("metric.reach")} ${formatCount(figures.reach)}`}
          />
        );
      case "KPI":
        return kpi ? (
          <KpiTile
            {...kpi}
            figures={figures}
            range={range}
            currency={currency}
            currencyFigures={currencyPerformances}
            preview={preview}
            move={move}
          />
        ) : null;
    }
  };

  const cell = (tile: SummaryTile) => {
    const group = tile === "KPI" && kpiGroup;
    const move = movable ? moveOf(tile) : undefined;
    return (
      <SummaryCell key={tile} tile={tile} movable={movable} group={group}>
        {group ? render(tile, { move }) : (
          <>
            {render(tile)}
            {move ? <MoveHandle {...move} /> : null}
          </>
        )}
      </SummaryCell>
    );
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={MEASURING}
        accessibility={{
          announcements: SILENT,
          screenReaderInstructions: { draggable: t("summary.move.hint") },
        }}
        onDragStart={({ active }) => {
          const tile = tileOf(active.id);
          if (tile) setDrag(dragStarted(settled, tile));
        }}
        onDragOver={({ over }) => {
          const current = dragRef.current;
          if (!current) return;
          const next = draggedOver(current, tileOf(over?.id));
          if (next !== current) setDrag(next);
        }}
        onDragEnd={() => {
          const done = dragRef.current;
          setDrag(null);
          if (done && !sameOrder(done.order, settled)) arrange(done.order, done.tile);
        }}
        onDragCancel={() => setDrag(null)}
      >
        <div
          role="group"
          aria-label={t("summary.title")}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        >
          {shown.map(cell)}
          {configurable ? (
            <AddTile
              label={t("summary.configure")}
              onClick={() => setConfiguring(true)}
            />
          ) : null}
        </div>
        {createPortal(
          <DragOverlay dropAnimation={DROP_ANIMATION}>
            {drag ? (
              <div
                className={cn(
                  "h-full cursor-grabbing",
                  drag.tile === "KPI" && kpiGroup && "grid grid-flow-col auto-cols-fr gap-3",
                )}
              >
                {render(drag.tile)}
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      <p aria-live="polite" className="sr-only">{announcement}</p>

      <Dialog open={configurable && configuring} onOpenChange={setConfiguring}>
        <DialogContent className="w-[min(760px,calc(100vw-2rem))] max-w-none">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogTitle>{t("summary.title")}</DialogTitle>
              <span className="text-sm tabular-nums text-muted-foreground">
                {chosen.length}/{MAX_SUMMARY_TILES}
              </span>
            </div>
            <DialogDescription>
              {atLimit ? t("summary.limit") : t("summary.choose")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offered.map((tile) => {
              const selected = chosen.includes(tile);
              return (
                <button
                  key={tile}
                  type="button"
                  aria-label={LABELS[tile]}
                  aria-pressed={selected}
                  data-selected={selected ? "true" : "false"}
                  disabled={!selected && atLimit}
                  onClick={() =>
                    onTilesChange?.(toggledTiles(tiles, tile, offered))
                  }
                  className={cn(
                    "h-full rounded-xl border-2 p-1 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-border",
                  )}
                >
                  <div className="pointer-events-none h-full">
                    {render(tile, { preview: true })}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
