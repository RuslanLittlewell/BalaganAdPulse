import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table.js";

export type CellAlign = "left" | "right";

export interface DataColumn {
  id: string;
  label: string;
  align?: CellAlign;
}

export interface DataRow {
  id: string;
  cells: Record<string, ReactNode>;
}

export interface DataTableProps {
  columns: DataColumn[];
  rows: DataRow[];
  footer?: DataRow;
  /** Rendered in a trailing column, once per body row. Never called for the footer. */
  rowAction?: (row: DataRow) => ReactNode;
}

/** The first column is a row header, so it can stick to the left edge while scrolling. */
function Cells({ columns, row }: { columns: DataColumn[]; row: DataRow }) {
  return (
    <>
      {columns.map((column, index) => {
        const align = column.align ?? "left";
        return index === 0 ? (
          <TableHead
            key={column.id}
            scope="row"
            data-align={align}
            className="sticky left-0 bg-background font-medium text-foreground"
          >
            {row.cells[column.id]}
          </TableHead>
        ) : (
          <TableCell key={column.id} data-align={align} className="p-0">
            {row.cells[column.id]}
          </TableCell>
        );
      })}
    </>
  );
}

/** The sheet grid, on shadcn's Table primitives. */
export function DataTable({ columns, rows, footer, rowAction }: DataTableProps) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead
                key={column.id}
                scope="col"
                data-align={column.align ?? "left"}
                className={index === 0 ? "sticky left-0 bg-background" : undefined}
              >
                {column.label}
              </TableHead>
            ))}
            {rowAction != null && <TableHead scope="col" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <Cells columns={columns} row={row} />
              {rowAction != null && (
                <TableCell className="text-right">{rowAction(row)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
        {footer != null && (
          <TableFooter>
            <TableRow>
              <Cells columns={columns} row={footer} />
              {rowAction != null && <TableCell />}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
