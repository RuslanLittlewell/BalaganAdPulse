import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerformanceTable, type PerformanceRow } from "@/widgets/performance-table/index.js";
import { useColumnWidths } from "@/widgets/performance-table/columnWidths.js";

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

  it("prices the figures in the currency it is given", () => {
    render(<PerformanceTable heading="Кампания" rows={rows} currency="BYN" totals={performance(1500)} />);

    const row = screen.getByRole("row", { name: /Поиск \/ Москва/ });
    expect(within(row).getByText("1 000 Br")).toBeInTheDocument();
    const footer = screen.getByRole("row", { name: /Итого/ });
    expect(within(footer).getByText("1 500 Br")).toBeInTheDocument();
  });

  it("lets a row carry its own currency, for a table that spans projects", () => {
    render(
      <PerformanceTable
        heading="Проект"
        currency="BYN"
        rows={[
          { id: "p1", name: "Клиника", performance: performance(1000) },
          { id: "p2", name: "Студия", performance: performance(500), currency: "USD" },
        ]}
      />,
    );

    expect(within(screen.getByRole("row", { name: /Клиника/ })).getByText("1 000 Br")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Студия/ })).getByText("500 $")).toBeInTheDocument();
  });

  it("names every column", () => {
    render(<PerformanceTable heading="Кампания" rows={rows} />);

    for (const label of ["Кампания", "Расход", "Показы", "CTR", "ROAS", "Частота"]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeInTheDocument();
    }
  });

  it("calls the lead count Лиды and its cost CPL", async () => {
    const user = userEvent.setup();
    render(<PerformanceTable tableKey="lead-labels-test" heading="Кампания" rows={rows} />);

    expect(screen.getByRole("columnheader", { name: "Лиды" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "CPL" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Конверсии" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "CPA" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Лиды" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "CPL" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox", { name: "Конверсии" })).toBeNull();
    expect(screen.queryByRole("menuitemcheckbox", { name: "CPA" })).toBeNull();
  });

  it("keeps a column choice saved before the lead columns were renamed", () => {
    useColumnWidths.setState({ visibleColumns: { "saved-before-rename": ["name", "spend", "cpa"] } });

    render(<PerformanceTable tableKey="saved-before-rename" heading="Кампания" rows={rows} />);

    expect(screen.getByRole("columnheader", { name: "CPL" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Лиды" })).toBeNull();
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

  it("keeps two columns, allows restoring hidden columns, and remembers the selection per table", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <PerformanceTable tableKey="column-menu-test" heading="Кампания" rows={rows} totals={performance(1500)} />,
    );
    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    const items = screen.getAllByRole("menuitemcheckbox");
    for (const item of items.slice(0, -2)) await user.click(item);

    const checked = screen.getAllByRole("menuitemcheckbox", { checked: true });
    expect(checked).toHaveLength(2);
    checked.forEach((item) => expect(item).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("menuitemcheckbox", { name: "Кампания" })).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Кампания" }));
    expect(screen.getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(3);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("columnheader", { name: "Расход" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Кампания" })).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("adpulse-performance-column-widths")!);
    expect(stored.state.visibleColumns["column-menu-test"]).toHaveLength(3);

    unmount();
    const remounted = render(<PerformanceTable tableKey="column-menu-test" heading="Кампания" rows={rows} />);
    expect(screen.queryByRole("columnheader", { name: "Расход" })).toBeNull();
    remounted.unmount();
    render(<PerformanceTable tableKey="other-table-test" heading="Проект" rows={rows} />);
    expect(screen.getByRole("columnheader", { name: "Расход" })).toBeInTheDocument();
  });
});

describe("extra columns a table is given", () => {
  const extraColumns = [{ id: "crm-new", label: "Лид (Новый)" }];
  const withExtras: PerformanceRow[] = [
    { ...rows[0], extra: { "crm-new": 7 } },
    { ...rows[1] },
  ];

  it("offers them hidden, shows their values once turned on, and remembers them", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <PerformanceTable tableKey="extra-columns-test" heading="Проект" rows={withExtras} extraColumns={extraColumns} />,
    );
    expect(screen.queryByRole("columnheader", { name: "Лид (Новый)" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Лид (Новый)" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("columnheader", { name: "Лид (Новый)" })).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Поиск \/ Москва/ })).getByText("7")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Лента \/ Россия/ })).getByText("0")).toBeInTheDocument();

    unmount();
    render(<PerformanceTable tableKey="extra-columns-test" heading="Проект" rows={withExtras} extraColumns={extraColumns} />);
    expect(screen.getByRole("columnheader", { name: "Лид (Новый)" })).toBeInTheDocument();
  });

  it("counts them toward the two columns a table keeps", async () => {
    const user = userEvent.setup();
    render(<PerformanceTable tableKey="extra-minimum-test" heading="Проект" rows={withExtras} extraColumns={extraColumns} />);

    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Лид (Новый)" }));
    const metrics = screen.getAllByRole("menuitemcheckbox").filter((item) => item.textContent !== "Лид (Новый)");
    for (const item of metrics) {
      if (item.getAttribute("aria-checked") === "true" && item.getAttribute("aria-disabled") !== "true") await user.click(item);
    }

    expect(screen.getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(2);
    expect(screen.getByRole("menuitemcheckbox", { name: "Лид (Новый)" })).toHaveAttribute("aria-checked", "true");
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
