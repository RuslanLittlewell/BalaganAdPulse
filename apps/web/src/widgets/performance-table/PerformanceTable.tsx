import { Fragment, useRef, useState, type ReactNode } from "react";
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  TriangleIcon,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/index.js";
import { cn } from "@/shared/lib/utils.js";
import { formatCount, type Currency } from "@/shared/lib/index.js";
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
  isRequiredColumn,
  orderedColumnIds,
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
  extra?: Record<string, number>;
}

export interface ExtraColumn {
  id: string;
  label: string;
}

export interface PerformanceTableProps {
  tableKey?: string;
  heading: string;
  rows: PerformanceRow[];
  totals?: Performance;
  currency?: Currency;
  onOpen?: (id: string) => void;
  onExpandedChange?: (ids: ReadonlySet<string>) => void;
  empty?: string;
  extraColumns?: readonly ExtraColumn[];
}

const NO_EXTRA_COLUMNS: readonly ExtraColumn[] = [];

interface FigureColumn {
  id: string;
  label: string;
  value: (
    performance: Performance,
    currency: Currency,
    extra?: Record<string, number>,
  ) => ReactNode;
}

function Figures({
  performance,
  currency,
  figures,
  extra,
}: {
  performance: Performance;
  currency: Currency;
  figures: readonly FigureColumn[];
  extra?: Record<string, number>;
}) {
  return (
    <>
      {figures.map((column) => (
        <TableCell
          key={column.id}
          className="overflow-hidden text-right tabular-nums whitespace-nowrap last:pr-5"
        >
          {column.value(performance, currency, extra)}
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
    stable: "border-blue-500",
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
      className="sticky left-0 z-10 overflow-hidden bg-muted/50 font-normal"
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
  heading,
  rows,
  totals,
  currency = "RUB",
  onOpen,
  onExpandedChange,
  empty,
  extraColumns = NO_EXTRA_COLUMNS,
}: PerformanceTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
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
  const setColumnWidth = useColumnWidths((state) => state.setColumnWidth);
  const savedOrder = useColumnWidths((state) => state.columnOrder?.[tableKey]);
  const moveColumn = useColumnWidths((state) => state.moveColumn);
  const savedColumns = useColumnWidths(
    (state) => state.visibleColumns?.[tableKey],
  );
  const toggleColumn = useColumnWidths((state) => state.toggleColumn);
  const extraIds = extraColumns.map((column) => column.id);
  const visibleIds = visibleColumnIds(savedColumns, extraIds);
  const allFigures: FigureColumn[] = [
    ...METRIC_COLUMNS.map((column) => ({
      id: column.id,
      label: column.label,
      value: (performance: Performance, figureCurrency: Currency) =>
        column.format(performance, figureCurrency),
    })),
    ...extraColumns.map((column) => ({
      id: column.id,
      label: column.label,
      value: (_: Performance, __: Currency, extra?: Record<string, number>) =>
        extra == null ? null : formatCount(extra[column.id] ?? 0),
    })),
  ];
  const figureIds = allFigures.map((column) => column.id);
  const figures = orderedColumnIds(savedOrder, figureIds)
    .filter((id) => visibleIds.includes(id))
    .map((id) => allFigures.find((column) => column.id === id)!);
  const shownFigureIds = figures.map((column) => column.id);
  const widthOf = (id: string) => columnWidth(savedWidths?.[id]);
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
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  const renderRow = (row: PerformanceRow, depth: number): ReactNode => {
    const expandable = row.expandable ?? row.children != null;
    const activate = expandable
      ? () => toggle(row.id)
      : onOpen != null
        ? () => onOpen(row.id)
        : undefined;
    const isOpen = expanded.has(row.id);

    return (
      <Fragment key={row.id}>
        <TableRow
          onClick={activate}
          className="group cursor-pointer"
        >
          <Name
            row={row}
            depth={depth}
            expandable={expandable}
            expanded={expandable ? isOpen : undefined}
            onActivate={activate}
          />
          <Figures
            figures={figures}
            extra={row.extra ?? {}}
            performance={row.performance}
            currency={row.currency ?? currency}
          />
          <TableCell aria-hidden />
        </TableRow>
        {isOpen &&
          (row.children ?? []).map((child) => renderRow(child, depth + 1))}
      </Fragment>
    );
  };

  return (
    <div className="min-h-0 overflow-auto rounded-lg border border-border">
      <Table
        className="table-fixed text-sm"
        style={{
          width:
            nameWidth +
            figures.reduce((sum, column) => sum + widthOf(column.id), 0) +
            40,
          minWidth: "100%",
        }}
      >
        <colgroup>
          <col style={{ width: nameWidth }} />
          {figures.map((column) => (
            <col key={column.id} style={{ width: widthOf(column.id) }} />
          ))}
          <col style={{ width: 40 }} />
        </colgroup>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead
              scope="col"
              aria-label={heading}
              className="sticky left-0 z-10 pr-3"
            >
              <span className="block truncate" title={heading}>
                {heading}
              </span>
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
                className="group/column relative pl-3 pr-6 text-right whitespace-nowrap"
              >
                <span className="block truncate" title={column.label}>
                  {column.label}
                </span>
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
                  onResize={(width) =>
                    setColumnWidth(tableKey, column.id, width)
                  }
                />
              </TableHead>
            ))}
            <TableHead className="sticky right-0 z-20">
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
                        toggleColumn(tableKey, column.id, extraIds)
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
        <TableBody>{rows.map((row) => renderRow(row, 0))}</TableBody>
        {totals != null && (
          <TableFooter>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead
                scope="row"
                className="sticky left-0 z-10 truncate font-medium"
              >
                {t("metric.total")}
              </TableHead>
              <Figures
                figures={figures}
                performance={totals}
                currency={currency}
              />
              <TableCell aria-hidden />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
