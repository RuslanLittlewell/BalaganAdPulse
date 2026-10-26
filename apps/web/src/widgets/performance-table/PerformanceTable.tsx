import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type UIEvent } from "react";
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  TriangleIcon,
} from "lucide-react";
import {
  Button,
  SortButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/index.js";
import { cn } from "@/shared/lib/utils.js";
import {
  ariaSortOf,
  formatCount,
  sortRows,
  useSortState,
  type Currency,
  type SortValue,
  type TableSort,
} from "@/shared/lib/index.js";
import {
  METRIC_COLUMNS,
  type Performance,
  type PerformanceTone,
} from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";
import {
  DEFAULT_NAME_WIDTH,
  MIN_COLUMN_WIDTH,
  MIN_NAME_WIDTH,
  MIN_VISIBLE_COLUMNS,
  columnWidth,
  fitWidths,
  isRequiredColumn,
  orderedColumnIds,
  resizedWidths,
  useColumnWidths,
  visibleColumnIds,
  type MoveDirection,
} from "./columnWidths.js";

export interface PerformanceRow {
  id: string;
  name: string;
  note?: string;
  badge?: ReactNode;
  tone?: PerformanceTone;
  performance: Performance;
  currency?: Currency;
  children?: PerformanceRow[];
  expandable?: boolean;
  extra?: Record<string, number | string | null>;
  mixedResults?: boolean;
}

export interface ExtraColumn {
  id: string;
  label: string;
  format?: (value: number, currency: Currency) => string;
  shown?: boolean;
}

export interface PerformanceTableProps {
  tableKey?: string;
  inheritFrom?: string;
  heading: string;
  rows: PerformanceRow[];
  totals?: Performance;
  totalsExtra?: Record<string, number | string | null>;
  totalsMixedResults?: boolean;
  currency?: Currency;
  onOpen?: (id: string) => void;
  onExpandedChange?: (ids: ReadonlySet<string>) => void;
  empty?: string;
  extraColumns?: readonly ExtraColumn[];
  visibleRows?: number;
  highlightedId?: string;
}

const NO_EXTRA_COLUMNS: readonly ExtraColumn[] = [];
const ESTIMATED_ROW_HEIGHT = 53;
const OVERSCAN = 5;

const NAME_COLUMN = "name";

function figureOf(row: PerformanceRow, key: string): SortValue {
  const own = (row.performance as unknown as Record<string, SortValue>)[key];
  return own !== undefined ? own : row.extra?.[key];
}

function sortTree(rows: PerformanceRow[], sort: TableSort | null): PerformanceRow[] {
  if (sort === null) return rows;
  const value = (row: PerformanceRow): SortValue => (sort.key === NAME_COLUMN ? row.name : figureOf(row, sort.key));
  return sortRows(rows, value, sort.direction).map((row) =>
    row.children == null ? row : { ...row, children: sortTree(row.children, sort) },
  );
}

interface ShownRow {
  key: string;
  row: PerformanceRow;
  depth: number;
}

function shownRows(rows: readonly PerformanceRow[], expanded: ReadonlySet<string>, parent = "", depth = 0): ShownRow[] {
  return rows.flatMap((row) => {
    const key = `${parent}/${row.id}`;
    return [
      { key, row, depth },
      ...(expanded.has(row.id) ? shownRows(row.children ?? [], expanded, key, depth + 1) : []),
    ];
  });
}

function useRowWindow(total: number, limit: number | undefined) {
  const scroller = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(ESTIMATED_ROW_HEIGHT);
  const [frame, setFrame] = useState(0);
  const [first, setFirst] = useState(0);
  const windowed = limit != null && total > limit;

  useLayoutEffect(() => {
    const element = scroller.current;
    const table = element?.querySelector("table");
    if (!windowed || !element || !table) return;
    const measure = () => {
      const row = element.querySelector("tbody tr[aria-rowindex]")?.getBoundingClientRect().height ?? 0;
      if (row > 0) setRowHeight(row);
      const head = element.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const foot = element.querySelector("tfoot")?.getBoundingClientRect().height ?? 0;
      setFrame(head + foot + element.offsetHeight - element.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    return () => observer.disconnect();
  }, [windowed]);

  const reveal = useCallback((index: number) => {
    const element = scroller.current;
    if (!windowed || limit == null || !element || (index >= first && index < first + limit)) return;
    const top = Math.max(0, index - Math.floor(limit / 2)) * rowHeight;
    element.scrollTop = top;
    setFirst(Math.floor(top / rowHeight));
  }, [windowed, limit, first, rowHeight]);

  if (!windowed) {
    return { scroller, windowed, start: 0, end: total, before: 0, after: 0, reveal };
  }
  const start = Math.max(0, first - OVERSCAN);
  const end = Math.min(total, first + limit + OVERSCAN);
  return {
    scroller,
    windowed,
    start,
    end,
    before: start * rowHeight,
    after: (total - end) * rowHeight,
    maxHeight: frame + limit * rowHeight,
    onScroll: (event: UIEvent<HTMLDivElement>) =>
      setFirst(Math.floor(event.currentTarget.scrollTop / rowHeight)),
    reveal,
  };
}

const RESERVED_COLUMN_WIDTH = 40;

function useAvailableWidth(scroller: RefObject<HTMLDivElement | null>, active: boolean): number {
  const [available, setAvailable] = useState(0);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!active || !element) return;
    const measure = () => setAvailable(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scroller, active]);
  return available;
}

interface FigureColumn {
  id: string;
  label: string;
  value: (
    performance: Performance,
    currency: Currency,
    extra?: Record<string, number | string | null>,
    mixedResults?: boolean,
  ) => ReactNode;
}

function Figures({
  performance,
  currency,
  figures,
  extra,
  mixedResults,
}: {
  performance: Performance;
  currency: Currency;
  figures: readonly FigureColumn[];
  extra?: Record<string, number | string | null>;
  mixedResults?: boolean;
}) {
  return (
    <>
      {figures.map((column) => (
        <TableCell
          key={column.id}
          className="overflow-hidden pr-[33px] text-right tabular-nums whitespace-nowrap"
        >
          {column.value(performance, currency, extra, mixedResults)}
        </TableCell>
      ))}
    </>
  );
}

function ColumnResizer({
  label,
  width,
  min,
  onResize,
}: {
  label: string;
  width: number;
  min: number;
  onResize: (width: number) => void;
}) {
  const resize = useRef<{ x: number; width: number } | null>(null);
  return (
    <span
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuenow={width}
      className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none border-r-2 border-border hover:border-primary focus-visible:border-primary focus-visible:outline-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        resize.current = { x: event.clientX, width };
      }}
      onPointerMove={(event) => {
        if (resize.current == null) return;
        onResize(resize.current.width + event.clientX - resize.current.x);
      }}
      onPointerUp={(event) => {
        resize.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        resize.current = null;
      }}
      onLostPointerCapture={() => {
        resize.current = null;
      }}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
        event.preventDefault();
        onResize(
          event.key === "Home"
            ? min
            : width + (event.key === "ArrowLeft" ? -10 : 10),
        );
      }}
    />
  );
}

function MoveButton({
  label,
  direction,
  onMove,
}: {
  label: string;
  direction: MoveDirection;
  onMove: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${t(direction === "left" ? "table.moveLeft" : "table.moveRight")} «${label}»`}
      className={cn(
        "absolute top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-primary focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/column:opacity-100",
        direction === "left" ? "left-0.5" : "right-2.5",
      )}
      onClick={onMove}
    >
      <TriangleIcon
        aria-hidden
        className={cn(
          "size-2 fill-current",
          direction === "left" ? "-rotate-90" : "rotate-90",
        )}
      />
    </button>
  );
}

function Name({
  row,
  depth,
  expandable,
  expanded,
  onActivate,
}: {
  row: PerformanceRow;
  depth: number;
  expandable: boolean;
  expanded?: boolean;
  onActivate?: () => void;
}) {
  const toneClass = {
    idle: "border-muted-foreground/40",
    danger: "border-red-500",
    stable: "border-amber-400",
    profitable: "border-emerald-500",
  }[row.tone ?? "stable"];
  const marked =
    row.tone != null ? `border-l-4 ${toneClass} pl-2 py-1` : undefined;
  const body = (
    <>
      {expandable && (
        <ChevronRightIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 transition-transform",
            expanded === true && "rotate-90",
          )}
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          title={row.name}
          className="block truncate font-medium text-foreground"
        >
          {row.name}
        </span>
        {row.note != null && (
          <span
            title={row.note}
            className="block truncate text-xs text-muted-foreground"
          >
            {row.note}
          </span>
        )}
      </span>
      {row.badge != null && (
        <span className="max-w-[35%] overflow-hidden">{row.badge}</span>
      )}
      {row.tone != null && <span className="sr-only">{t(`tone.${row.tone}`)}</span>}
    </>
  );

  return (
    <TableHead
      scope="row"
      className="sticky left-0 z-10 overflow-hidden bg-muted/50 font-normal shadow-[inset_0_1px_0_var(--border)] backdrop-blur-xl group-data-[highlighted=true]:bg-primary/20"
      style={{
        paddingLeft: depth === 0 ? undefined : `${depth * 1.5 + 0.75}rem`,
      }}
    >
      {onActivate == null ? (
        <span className={cn("flex items-center gap-2", marked)} data-tone={row.tone}>{body}</span>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onActivate();
          }}
          aria-expanded={expandable ? expanded === true : undefined}
          data-tone={row.tone}
          className={cn(
            "flex w-full items-center gap-2 rounded text-left hover:text-primary focus-visible:outline-2 focus-visible:outline-ring",
            marked,
          )}
        >
          {body}
        </button>
      )}
    </TableHead>
  );
}

export function PerformanceTable({
  tableKey = "performance",
  inheritFrom,
  heading,
  rows,
  totals,
  totalsExtra,
  totalsMixedResults,
  currency = "RUB",
  onOpen,
  onExpandedChange,
  empty,
  extraColumns = NO_EXTRA_COLUMNS,
  visibleRows,
  highlightedId,
}: PerformanceTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const inherit = useColumnWidths((state) => state.inherit);
  useLayoutEffect(() => {
    if (inheritFrom != null && inheritFrom !== tableKey) inherit(tableKey, inheritFrom);
  }, [inherit, tableKey, inheritFrom]);
  const sorting = useSortState();
  const shown = shownRows(sortTree(rows, sorting.sort), expanded);
  const rowWindow = useRowWindow(shown.length, visibleRows);
  const highlightedIndex = highlightedId == null ? -1 : shown.findIndex(({ row }) => row.id === highlightedId);
  const { reveal } = rowWindow;
  useEffect(() => {
    if (highlightedIndex >= 0) reveal(highlightedIndex);
  }, [highlightedIndex, reveal]);
  const savedWidth = useColumnWidths((state) => state.nameWidths?.[tableKey]);
  const nameWidth =
    typeof savedWidth === "number" && Number.isFinite(savedWidth)
      ? Math.max(MIN_NAME_WIDTH, savedWidth)
      : DEFAULT_NAME_WIDTH;
  const saveNameWidth = useColumnWidths((state) => state.setNameWidth);
  const setNameWidth = (width: number) => saveNameWidth(tableKey, width);
  const savedWidths = useColumnWidths(
    (state) => state.columnWidths?.[tableKey],
  );
  const setColumnWidths = useColumnWidths((state) => state.setColumnWidths);
  const savedOrder = useColumnWidths((state) => state.columnOrder?.[tableKey]);
  const moveColumn = useColumnWidths((state) => state.moveColumn);
  const savedColumns = useColumnWidths(
    (state) => state.visibleColumns?.[tableKey],
  );
  const offeredColumns = useColumnWidths((state) => state.offeredColumns?.[tableKey]);
  const toggleColumn = useColumnWidths((state) => state.toggleColumn);
  const extraIds = extraColumns.map((column) => column.id);
  const shownExtraIds = extraColumns.filter((column) => column.shown).map((column) => column.id);
  const visibleIds = visibleColumnIds(savedColumns, extraIds, shownExtraIds, offeredColumns);
  const allFigures: FigureColumn[] = [
    ...METRIC_COLUMNS.map((column) => ({
      id: column.id,
      label: column.label,
      value: (performance: Performance, figureCurrency: Currency, _?: unknown, mixedResults?: boolean) => {
        if (mixedResults && column.id === "costPerResult") return "—";
        return column.format(performance, figureCurrency);
      },
    })),
    ...extraColumns.map((column) => ({
      id: column.id,
      label: column.label,
      value: (_: Performance, figureCurrency: Currency, extra?: Record<string, number | string | null>) => {
        if (extra == null) return null;
        const value = extra[column.id] ?? null;
        if (typeof value === "string") return value;
        if (column.format == null) return formatCount(value ?? 0);
        return value === null ? "—" : column.format(value, figureCurrency);
      },
    })),
  ];
  const figureIds = allFigures.map((column) => column.id);
  const figures = orderedColumnIds(savedOrder, figureIds)
    .filter((id) => visibleIds.includes(id))
    .map((id) => allFigures.find((column) => column.id === id)!);
  const shownFigureIds = figures.map((column) => column.id);
  const available = useAvailableWidth(rowWindow.scroller, !(rows.length === 0 && empty != null));
  const room = available - nameWidth - RESERVED_COLUMN_WIDTH;
  const fitted = fitWidths(
    figures.map((column) => columnWidth(savedWidths?.[column.id])),
    room,
  );
  const widthOf = (id: string) => fitted[shownFigureIds.indexOf(id)] ?? columnWidth(savedWidths?.[id]);
  const resize = (id: string, width: number) => {
    const next = resizedWidths(fitted, shownFigureIds.indexOf(id), width, room);
    setColumnWidths(tableKey, Object.fromEntries(
      shownFigureIds.flatMap((shownId, index) =>
        next[index] === columnWidth(savedWidths?.[shownId]) ? [] : [[shownId, next[index]!]]),
    ));
  };
  const move = (id: string, direction: MoveDirection) =>
    moveColumn(tableKey, id, direction, shownFigureIds, figureIds);
  const choices = [...METRIC_COLUMNS, ...extraColumns]
    .filter((column) => !isRequiredColumn(column.id));

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (!next.delete(id)) next.add(id);
    setExpanded(next);
    onExpandedChange?.(next);
  };

  if (rows.length === 0 && empty != null) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground flex items-center justify-center">
        {empty}
      </div>
    );
  }

  const spanned = figures.length + 2;
  const renderRow = ({ key, row, depth }: ShownRow, index: number): ReactNode => {
    const expandable = row.expandable ?? row.children != null;
    const activate = expandable
      ? () => toggle(row.id)
      : onOpen != null
        ? () => onOpen(row.id)
        : undefined;

    const highlighted = highlightedId != null && row.id === highlightedId;

    return (
      <TableRow
        key={key}
        aria-rowindex={rowWindow.windowed ? index + 2 : undefined}
        data-highlighted={highlighted ? "true" : undefined}
        onClick={activate}
        className={cn(
          "group cursor-pointer",
          highlighted && "bg-primary/15 outline-1 -outline-offset-1 outline-primary/60 hover:bg-primary/15",
        )}
      >
        <Name
          row={row}
          depth={depth}
          expandable={expandable}
          expanded={expandable ? expanded.has(row.id) : undefined}
          onActivate={activate}
        />
        <Figures
          figures={figures}
          extra={row.extra ?? {}}
          mixedResults={row.mixedResults}
          performance={row.performance}
          currency={row.currency ?? currency}
        />
        <TableCell aria-hidden />
      </TableRow>
    );
  };
  const spacer = (height: number) =>
    height > 0 ? (
      <tr aria-hidden>
        <td colSpan={spanned} className="p-0" style={{ height }} />
      </tr>
    ) : null;

  return (
    <div
      ref={rowWindow.scroller}
      onScroll={rowWindow.onScroll}
      className="min-h-0 overflow-auto rounded-lg border border-border"
      style={{ maxHeight: rowWindow.maxHeight }}
    >
      <table
        data-slot="table"
        aria-rowcount={rowWindow.windowed ? shown.length + (totals != null ? 2 : 1) : undefined}
        className="w-full table-fixed caption-bottom text-sm"
        style={{
          width:
            nameWidth +
            fitted.reduce((sum, width) => sum + width, 0) +
            RESERVED_COLUMN_WIDTH,
          minWidth: "100%",
        }}
      >
        <colgroup>
          <col style={{ width: nameWidth }} />
          {figures.map((column) => (
            <col key={column.id} style={{ width: widthOf(column.id) }} />
          ))}
          <col />
        </colgroup>
        <TableHeader className="sticky top-0 z-20 [&_th]:backdrop-blur-xl">
          <TableRow aria-rowindex={rowWindow.windowed ? 1 : undefined} className="bg-muted/50 hover:bg-muted/50">
            <TableHead
              scope="col"
              aria-label={heading}
              aria-sort={ariaSortOf(sorting.directionOf(NAME_COLUMN))}
              className="sticky left-0 z-10 pr-3 backdrop-blur-xl"
            >
              <SortButton
                label={heading}
                direction={sorting.directionOf(NAME_COLUMN)}
                onSort={() => sorting.toggle(NAME_COLUMN)}
              />
              <ColumnResizer
                label={t("table.resizeName")}
                width={nameWidth}
                min={MIN_NAME_WIDTH}
                onResize={setNameWidth}
              />
            </TableHead>
            {figures.map((column, index) => (
              <TableHead
                key={column.id}
                scope="col"
                aria-label={column.label}
                aria-sort={ariaSortOf(sorting.directionOf(column.id))}
                className="group/column relative pl-3 pr-6 text-right whitespace-nowrap"
              >
                <SortButton
                  label={column.label}
                  direction={sorting.directionOf(column.id)}
                  align="end"
                  onSort={() => sorting.toggle(column.id)}
                />
                {index > 0 && (
                  <MoveButton
                    label={column.label}
                    direction="left"
                    onMove={() => move(column.id, "left")}
                  />
                )}
                {index < figures.length - 1 && (
                  <MoveButton
                    label={column.label}
                    direction="right"
                    onMove={() => move(column.id, "right")}
                  />
                )}
                <ColumnResizer
                  label={`${t("table.resizeColumn")} «${column.label}»`}
                  width={widthOf(column.id)}
                  min={MIN_COLUMN_WIDTH}
                  onResize={(width) => resize(column.id, width)}
                />
              </TableHead>
            ))}
            <TableHead className="sticky right-0 z-20 text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("table.columns")}
                  >
                    <EllipsisVerticalIcon aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="max-h-96 overflow-y-auto"
                >
                  <DropdownMenuLabel>{t("table.columns")}</DropdownMenuLabel>
                  <p className="px-2 pb-2 text-xs text-muted-foreground">
                    {t("table.minimumColumns")}
                  </p>
                  {choices.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={visibleIds.includes(column.id)}
                      disabled={
                        visibleIds.length <= MIN_VISIBLE_COLUMNS &&
                        visibleIds.includes(column.id)
                      }
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={() =>
                        toggleColumn(tableKey, column.id, extraIds, shownExtraIds)
                      }
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {spacer(rowWindow.before)}
          {shown.slice(rowWindow.start, rowWindow.end).map((entry, offset) => renderRow(entry, rowWindow.start + offset))}
          {spacer(rowWindow.after)}
        </TableBody>
        {totals != null && (
          <TableFooter className="sticky bottom-0 z-20 [&_th]:backdrop-blur-xl [&_td]:backdrop-blur-xl">
            <TableRow aria-rowindex={rowWindow.windowed ? shown.length + 2 : undefined} className="bg-muted/50 hover:bg-muted/50">
              <TableHead
                scope="row"
                className="sticky left-0 z-10 truncate font-medium shadow-[inset_0_1px_0_var(--border)] backdrop-blur-xl"
              >
                {t("metric.total")}
              </TableHead>
              <Figures
                figures={figures}
                extra={totalsExtra}
                mixedResults={totalsMixedResults}
                performance={totals}
                currency={currency}
              />
              <TableCell aria-hidden />
            </TableRow>
          </TableFooter>
        )}
      </table>
    </div>
  );
}
