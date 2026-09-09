import { Fragment, useState, type ReactNode } from "react";
import { ChevronRightIcon } from "lucide-react";
import {
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
}: {
  performance: Performance;
  currency: Currency;
}) {
  return (
    <>
      {METRIC_COLUMNS.map((column) => (
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
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">
          {row.name}
        </span>
        {row.note != null && (
          <span className="block truncate text-xs text-muted-foreground">
            {row.note}
          </span>
        )}
      </span>
      {row.badge}
    </>
  );

  return (
    <TableHead
      scope="row"
      className="sticky left-0 z-10 bg-background font-normal"
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
  heading,
  rows,
  totals,
  currency = "RUB",
  onOpen,
  onExpandedChange,
  empty,
}: PerformanceTableProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

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
        <TableRow onClick={activate} className={"cursor-pointer"}>
          <Name
            row={row}
            depth={depth}
            expandable={expandable}
            expanded={expandable ? isOpen : undefined}
            onActivate={activate}
          />
          <Figures performance={row.performance} currency={row.currency ?? currency} />
        </TableRow>
        {isOpen &&
          (row.children ?? []).map((child) => renderRow(child, depth + 1))}
      </Fragment>
    );
  };

  return (
    <div className="min-h-0 overflow-auto rounded-lg border border-border">
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead scope="col" className="sticky left-0 z-10 bg-muted">
              {heading}
            </TableHead>
            {METRIC_COLUMNS.map((column) => (
              <TableHead
                key={column.id}
                scope="col"
                className="text-right whitespace-nowrap last:pr-5"
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows.map((row) => renderRow(row, 0))}</TableBody>
        {totals != null && (
          <TableFooter>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead
                scope="row"
                className="sticky left-0 z-10 bg-muted font-medium"
              >
                {t("metric.total")}
              </TableHead>
              <Figures performance={totals} currency={currency} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
