import { render, screen, within } from "@testing-library/react";
import { DataTable } from "./DataTable.js";

const columns = [
  { id: "date", label: "DATE" },
  { id: "spend", label: "SPEND", align: "right" as const },
];

const rows = [
  { id: "r1", cells: { date: "01 Aug", spend: "120.00" } },
  { id: "r2", cells: { date: "02 Aug", spend: "135.50" } },
];

describe("DataTable", () => {
  it("renders a header cell per column", () => {
    render(<DataTable columns={columns} rows={rows} />);

    expect(screen.getByRole("columnheader", { name: "DATE" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "SPEND" })).toBeInTheDocument();
  });

  it("renders a row per entry with cells in column order", () => {
    render(<DataTable columns={columns} rows={rows} />);

    const body = screen.getAllByRole("rowgroup")[1];
    const bodyRows = within(body).getAllByRole("row");
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0]).getByRole("rowheader")).toHaveTextContent("01 Aug");
    expect(within(bodyRows[0]).getByRole("cell")).toHaveTextContent("120.00");
  });

  it("renders the footer row when given one", () => {
    render(
      <DataTable columns={columns} rows={rows} footer={{ id: "totals", cells: { date: "TOTAL", spend: "255.50" } }} />,
    );

    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).getByRole("rowheader")).toHaveTextContent("TOTAL");
    expect(within(footer).getByRole("cell")).toHaveTextContent("255.50");
  });

  it("marks alignment on header and body cells", () => {
    render(<DataTable columns={columns} rows={rows} />);

    expect(screen.getByRole("columnheader", { name: "SPEND" })).toHaveAttribute("data-align", "right");
    expect(screen.getByRole("columnheader", { name: "DATE" })).toHaveAttribute("data-align", "left");
  });
});
