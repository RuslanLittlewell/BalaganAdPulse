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
import {
  METRIC_COLUMNS,
  type Performance,
  type PerformanceTone,
} from "@/entities/campaign/index.js";
import { t } from "@/shared/config/index.js";

export interface PerformanceRow {
  id: string;
  name: string;
  /** What the row is, under its name: a channel, an audience, a format. */
  note?: string;
  badge?: ReactNode;
  /** Optional period result marker drawn around the row name. */
  tone?: PerformanceTone;
  performance: Performance;
  /** The level below, revealed by expanding the row. May arrive after the row
   * is expanded — see `expandable`. */
  children?: PerformanceRow[];
  /**
   * Whether the row has a level beneath it, when that is known before the rows
   * themselves are. Without it a row whose children are still loading would
   * offer no way to ask for them.
   */
  expandable?: boolean;
}

export interface PerformanceTableProps {
  /** What the first column holds — "Кампания", "Группа", "Проект". */
  heading: string;
  rows: PerformanceRow[];
  /** The summed range, handed in whole. Never added up from the rows on screen:
   * a ratio cannot be summed, and a range's ROAS is not the average of its
   * campaigns'. */
  totals?: Performance;
  onOpen?: (id: string) => void;
  /** Which rows are open now. The table keeps the state; this reports it, so a
   * caller can load a level only once someone has asked to see it. */
  onExpandedChange?: (ids: ReadonlySet<string>) => void;
  empty?: string;
}

function Figures({ performance }: { performance: Performance }) {
  return (
    <>
      {METRIC_COLUMNS.map((column) => (
        <TableCell
          key={column.id}
          className="text-right tabular-nums whitespace-nowrap"
        >
          {column.format(performance)}
        </TableCell>
      ))}
    </>
  );
}

/** The name cell: a button when the row leads somewhere, plain text otherwise.
 * A row that looks clickable and is not is worse than one that never offered. */
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
    // Expanding wins over opening: a row with a level beneath it is a way in to
    // that level, and the screen for it is one click further.
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
          <Figures performance={row.performance} />
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
          <TableRow>
            <TableHead scope="col" className="sticky left-0 z-10 bg-background">
              {heading}
            </TableHead>
            {METRIC_COLUMNS.map((column) => (
              <TableHead
                key={column.id}
                scope="col"
                className="text-right whitespace-nowrap"
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows.map((row) => renderRow(row, 0))}</TableBody>
        {totals != null && (
          <TableFooter>
            <TableRow>
              <TableHead
                scope="row"
                className="sticky left-0 z-10 bg-muted font-medium"
              >
                {t("metric.total")}
              </TableHead>
              <Figures performance={totals} />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
