import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerformanceTable, type PerformanceRow } from "@/widgets/performance-table/index.js";

const performance = (spend: number, extra = {}) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5, ...extra,
});

const rows: PerformanceRow[] = [
  { id: "c1", name: "Поиск / Москва", note: "Яндекс Директ", performance: performance(1000) },
  { id: "c2", name: "Лента / Россия", note: "Meta", performance: performance(500) },
];

describe("PerformanceTable", () => {
  it("renders a row per entity with all twelve figures", () => {
    render(<PerformanceTable heading="Кампания" rows={rows} />);

    const row = screen.getByRole("row", { name: /Поиск \/ Москва/ });
    expect(within(row).getByText("1 000 ₽")).toBeInTheDocument();
    expect(within(row).getByText("2,00%")).toBeInTheDocument();
    expect(within(row).getByText("4,00x")).toBeInTheDocument();
  });

  it("names every column", () => {
    render(<PerformanceTable heading="Кампания" rows={rows} />);

    for (const label of ["Кампания", "Расход", "Показы", "CTR", "ROAS", "Частота"]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeInTheDocument();
    }
  });

  it("shows the totals it is given, not the sum of the rows on screen", () => {
    render(
      <PerformanceTable heading="Кампания" rows={rows} totals={performance(1500, { roas: 3 })} />,
    );

    const footer = screen.getByRole("row", { name: /Итого/ });
    expect(within(footer).getByText("1 500 ₽")).toBeInTheDocument();
    expect(within(footer).getByText("3,00x")).toBeInTheDocument();
  });

  it("opens a row when it is chosen", async () => {
    const user = userEvent.setup();
    const opened: string[] = [];
    render(<PerformanceTable heading="Кампания" rows={rows} onOpen={(id) => opened.push(id)} />);

    await user.click(screen.getByRole("button", { name: /Поиск \/ Москва/ }));

    expect(opened).toEqual(["c1"]);
  });

  it("leaves rows inert when nothing opens them", () => {
    render(<PerformanceTable heading="Кампания" rows={rows} />);

    expect(screen.queryByRole("button", { name: /Поиск \/ Москва/ })).toBeNull();
  });

  it("says so when there is nothing to show", () => {
    render(<PerformanceTable heading="Кампания" rows={[]} empty="Пока нет кампаний" />);

    expect(screen.getByText("Пока нет кампаний")).toBeInTheDocument();
  });
});

describe("rows that contain rows", () => {
  const nested: PerformanceRow[] = [
    {
      id: "s1", name: "Москва · 28–55", note: "Гео Москва", performance: performance(600),
      children: [{ id: "a1", name: "Приём сегодня", note: "Текст", performance: performance(300) }],
    },
  ];

  it("hides the children until the parent is expanded", async () => {
    const user = userEvent.setup();
    render(<PerformanceTable heading="Группа" rows={nested} />);

    expect(screen.queryByText("Приём сегодня")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Москва · 28–55/ }));

    expect(screen.getByText("Приём сегодня")).toBeInTheDocument();
  });

  it("reports which rows are open", async () => {
    const user = userEvent.setup();
    const reported: string[][] = [];
    render(
      <PerformanceTable
        heading="Группа"
        rows={nested}
        onExpandedChange={(ids) => reported.push([...ids])}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Москва · 28–55/ }));
    await user.click(screen.getByRole("button", { name: /Москва · 28–55/ }));

    expect(reported).toEqual([["s1"], []]);
  });

  it("offers a way in before the children have arrived", async () => {
    const user = userEvent.setup();
    render(
      <PerformanceTable
        heading="Группа"
        rows={[{ id: "s1", name: "Москва · 28–55", performance: performance(600), expandable: true }]}
        onOpen={() => { throw new Error("an expandable row must not open a screen"); }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Москва · 28–55/ }));

    expect(screen.getByRole("button", { name: /Москва · 28–55/ }))
      .toHaveAttribute("aria-expanded", "true");
  });

  it("collapses again", async () => {
    const user = userEvent.setup();
    render(<PerformanceTable heading="Группа" rows={nested} />);
    const toggle = screen.getByRole("button", { name: /Москва · 28–55/ });

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Приём сегодня")).toBeNull();
  });
});
