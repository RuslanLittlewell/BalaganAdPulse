import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

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
          <th key={column.id} scope="row" data-align={align} className={styles.rowHeader}>
            {row.cells[column.id]}
          </th>
        ) : (
          <td key={column.id} data-align={align}>
            {row.cells[column.id]}
          </td>
        );
      })}
    </>
  );
}

export function DataTable({ columns, rows, footer, rowAction }: DataTableProps) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column.id}
                scope="col"
                data-align={column.align ?? "left"}
                className={index === 0 ? styles.corner : undefined}
              >
                {column.label}
              </th>
            ))}
            {rowAction != null && <th scope="col" className={styles.action} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <Cells columns={columns} row={row} />
              {rowAction != null && <td className={styles.action}>{rowAction(row)}</td>}
            </tr>
          ))}
        </tbody>
        {footer != null && (
          <tfoot>
            <tr>
              <Cells columns={columns} row={footer} />
              {rowAction != null && <td className={styles.action} />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
