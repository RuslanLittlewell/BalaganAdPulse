import { Fragment, useRef, useState, type ReactNode } from "react";
import { ChevronRightIcon, EllipsisVerticalIcon } from "lucide-react";
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
import type { Currency } from "@/shared/lib/index.js";
import {
  METRIC_COLUMNS,
  type Performance,
  type PerformanceTone,
} from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";
import { DEFAULT_NAME_WIDTH, MIN_NAME_WIDTH, MIN_VISIBLE_COLUMNS, isRequiredColumn, useColumnWidths, visibleColumnIds } from "./columnWidths.js";

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
}

function Figures({
  performance,
  currency,
  columns,
}: {
  performance: Performance;
  currency: Currency;
  columns: typeof METRIC_COLUMNS;
}) {
  return (
    <>
      {columns.map((column) => (
        <TableCell
          key={column.id}
          className="text-right tabular-nums whitespace-nowrap last:pr-5"
        >
          {column.format(performance, currency)}
        </TableCell>
      ))}
    </>
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
        <span title={row.name} className="block truncate font-medium text-foreground">
          {row.name}
        </span>
        {row.note != null && (
          <span title={row.note} className="block truncate text-xs text-muted-foreground">
            {row.note}
          </span>
        )}
      </span>
      {row.badge != null && <span className="max-w-[35%] overflow-hidden">{row.badge}</span>}
    </>
  );

  return (
    <TableHead
      scope="row"
      className={cn(
        "sticky left-0 z-10 overflow-hidden bg-background font-normal transition-colors",
        "group-hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))]",
        "group-has-[[aria-expanded=true]]:bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))]",
      )}
      style={{
        paddingLeft: depth === 0 ? undefined : `${depth * 1.5 + 0.75}rem`,
      }}
    >
      {onActivate == null ? (
        <span className={cn("flex items-center gap-2", marked)}>{body}</span>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onActivate();
          }}
          aria-expanded={expandable ? expanded === true : undefined}
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
}: PerformanceTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const savedWidth = useColumnWidths((state) => state.nameWidths?.[tableKey]);
  const nameWidth = typeof savedWidth === "number" && Number.isFinite(savedWidth)
    ? Math.max(MIN_NAME_WIDTH, savedWidth)
    : DEFAULT_NAME_WIDTH;
  const saveNameWidth = useColumnWidths((state) => state.setNameWidth);
  const setNameWidth = (width: number) => saveNameWidth(tableKey, width);
  const resize = useRef<{ x: number; width: number } | null>(null);
  const savedColumns = useColumnWidths((state) => state.visibleColumns?.[tableKey]);
  const toggleColumn = useColumnWidths((state) => state.toggleColumn);
  const visibleIds = visibleColumnIds(savedColumns, tableKey);
  const showName = visibleIds.includes("name");
  const columns = METRIC_COLUMNS.filter((column) => visibleIds.includes(column.id));
  const choices = [{ id: "name", label: heading }, ...METRIC_COLUMNS]
    .filter((column) => !isRequiredColumn(tableKey, column.id));

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
          tabIndex={!showName && activate != null ? 0 : undefined}
          aria-label={!showName ? row.name : undefined}
          aria-expanded={!showName && expandable ? isOpen : undefined}
          onKeyDown={!showName && activate != null ? (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            activate();
          } : undefined}
        >
          {showName && <Name
            row={row}
            depth={depth}
            expandable={expandable}
            expanded={expandable ? isOpen : undefined}
            onActivate={activate}
          />}
          <Figures columns={columns} performance={row.performance} currency={row.currency ?? currency} />
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
        style={{ width: (showName ? nameWidth : 0) + columns.length * 128 + 40, minWidth: "100%" }}
      >
        <colgroup>
          {showName && <col style={{ width: nameWidth }} />}
          {columns.map((column) => <col key={column.id} />)}
          <col style={{ width: 40 }} />
        </colgroup>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            {showName && <TableHead scope="col" aria-label={heading} className="sticky left-0 z-10 bg-muted pr-3">
              <span className="block truncate" title={heading}>{heading}</span>
              <span
                role="separator"
                tabIndex={0}
                aria-label={t("table.resizeName")}
                aria-orientation="vertical"
                aria-valuemin={MIN_NAME_WIDTH}
                aria-valuenow={nameWidth}
                className="absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none select-none border-r-2 border-border hover:border-primary focus-visible:border-primary focus-visible:outline-none"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  resize.current = { x: event.clientX, width: nameWidth };
                }}
                onPointerMove={(event) => {
                  if (resize.current == null) return;
                  setNameWidth(resize.current.width + event.clientX - resize.current.x);
                }}
                onPointerUp={(event) => {
                  resize.current = null;
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                }}
                onPointerCancel={() => { resize.current = null; }}
                onLostPointerCapture={() => { resize.current = null; }}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
                  event.preventDefault();
                  setNameWidth(event.key === "Home" ? MIN_NAME_WIDTH : nameWidth + (event.key === "ArrowLeft" ? -10 : 10));
                }}
              />
            </TableHead>}
            {columns.map((column) => (
              <TableHead
                key={column.id}
                scope="col"
                className="text-right whitespace-nowrap last:pr-5"
              >
                {column.label}
              </TableHead>
            ))}
            <TableHead className="sticky right-0 z-20 bg-muted p-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={t("table.columns")}>
                    <EllipsisVerticalIcon aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
                  <DropdownMenuLabel>{t("table.columns")}</DropdownMenuLabel>
                  <p className="px-2 pb-2 text-xs text-muted-foreground">{t("table.minimumColumns")}</p>
                  {choices.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={visibleIds.includes(column.id)}
                      disabled={visibleIds.length <= MIN_VISIBLE_COLUMNS && visibleIds.includes(column.id)}
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={() => toggleColumn(tableKey, column.id)}
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
            <TableRow aria-label={!showName ? t("metric.total") : undefined} className="bg-muted hover:bg-muted">
              {showName && <TableHead
                scope="row"
                className="sticky left-0 z-10 truncate bg-muted font-medium"
              >
                {t("metric.total")}
              </TableHead>}
              <Figures columns={columns} performance={totals} currency={currency} />
              <TableCell aria-hidden />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
