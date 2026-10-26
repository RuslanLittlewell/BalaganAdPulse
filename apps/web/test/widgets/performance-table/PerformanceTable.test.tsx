import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerformanceTable, type PerformanceRow } from "@/widgets/performance-table/index.js";
import { useColumnWidths } from "@/widgets/performance-table/columnWidths.js";

const performance = (spend: number, extra = {}) => ({
  spend, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, results: 80, revenue: 4000,
  ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, costPerResult: 12.5, roas: 4, frequency: 2.5, ...extra,
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

  it("shows results and their cost beside leads", () => {
    render(<PerformanceTable tableKey="results-test" heading="Кампания" rows={rows} />);

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers.indexOf("Результаты")).toBe(headers.indexOf("Лиды") + 1);
    expect(screen.getByRole("columnheader", { name: "Цена результата" })).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Поиск \/ Москва/ });
    expect(within(row).getByText("80")).toBeInTheDocument();
  });

  it("offers results in the chooser but keeps them hidden from a choice saved before they existed", async () => {
    const user = userEvent.setup();
    useColumnWidths.setState({ visibleColumns: { "saved-before-results": ["name", "spend", "conversions"] } });
    render(<PerformanceTable tableKey="saved-before-results" heading="Кампания" rows={rows} />);

    expect(screen.queryByRole("columnheader", { name: "Результаты" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    expect(screen.getByRole("menuitemcheckbox", { name: "Результаты" })).toHaveAttribute("aria-checked", "false");
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

  it("never offers the name column, keeps one figure beside it, and remembers the selection per table", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <PerformanceTable tableKey="column-menu-test" heading="Кампания" rows={rows} totals={performance(1500)} />,
    );
    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    expect(screen.queryByRole("menuitemcheckbox", { name: "Кампания" })).toBeNull();
    const items = screen.getAllByRole("menuitemcheckbox");
    for (const item of items.slice(0, -1)) await user.click(item);

    const checked = screen.getAllByRole("menuitemcheckbox", { checked: true });
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Расход" }));
    expect(screen.getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(2);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("columnheader", { name: "Показы" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Кампания" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Расход" })).toBeInTheDocument();

    unmount();
    const remounted = render(<PerformanceTable tableKey="column-menu-test" heading="Кампания" rows={rows} />);
    expect(screen.queryByRole("columnheader", { name: "Показы" })).toBeNull();
    remounted.unmount();
    render(<PerformanceTable tableKey="other-table-test" heading="Проект" rows={rows} />);
    expect(screen.getByRole("columnheader", { name: "Показы" })).toBeInTheDocument();
  });

  it("brings back the name column a choice saved earlier had hidden", () => {
    useColumnWidths.setState({ visibleColumns: { "hidden-name-test": ["spend", "clicks"] } });
    render(<PerformanceTable tableKey="hidden-name-test" heading="Проект" rows={rows} />);

    expect(screen.getByRole("columnheader", { name: "Проект" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Расход" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Показы" })).toBeNull();
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

  it("counts them as the figure a table keeps", async () => {
    const user = userEvent.setup();
    render(<PerformanceTable tableKey="extra-minimum-test" heading="Проект" rows={withExtras} extraColumns={extraColumns} />);

    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Лид (Новый)" }));
    const metrics = screen.getAllByRole("menuitemcheckbox").filter((item) => item.textContent !== "Лид (Новый)");
    for (const item of metrics) {
      if (item.getAttribute("aria-checked") === "true" && item.getAttribute("aria-disabled") !== "true") await user.click(item);
    }

    expect(screen.getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(1);
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

const headerNames = () =>
  screen.getAllByRole("columnheader").map((header) => header.getAttribute("aria-label")).filter(Boolean);

describe("sizing a figure column", () => {
  const handleOf = (label: string) =>
    screen.getByRole("separator", { name: `Изменить ширину столбца «${label}»` });

  it("offers every figure column a resize handle", () => {
    render(<PerformanceTable tableKey="resize-all-test" heading="Кампания" rows={rows} />);

    for (const label of ["Расход", "Показы", "CTR", "Частота"]) {
      expect(handleOf(label)).toHaveAttribute("aria-valuenow", "128");
    }
  });

  it("widens and narrows by keyboard, never below the minimum, and remembers it per table", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PerformanceTable tableKey="resize-test" heading="Кампания" rows={rows} />);

    handleOf("Расход").focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(handleOf("Расход")).toHaveAttribute("aria-valuenow", "148");

    await user.keyboard("{Home}{ArrowLeft}");
    expect(handleOf("Расход")).toHaveAttribute("aria-valuenow", "72");

    await user.keyboard("{ArrowRight}");
    unmount();
    const again = render(<PerformanceTable tableKey="resize-test" heading="Кампания" rows={rows} />);
    expect(handleOf("Расход")).toHaveAttribute("aria-valuenow", "82");
    expect(handleOf("Показы")).toHaveAttribute("aria-valuenow", "128");

    again.unmount();
    render(<PerformanceTable tableKey="resize-other-test" heading="Кампания" rows={rows} />);
    expect(handleOf("Расход")).toHaveAttribute("aria-valuenow", "128");
  });
});

describe("ordering the figure columns", () => {
  it("moves a column one place to the right in the header, the rows and the totals", async () => {
    const user = userEvent.setup();
    render(<PerformanceTable tableKey="order-test" heading="Кампания" rows={rows} totals={performance(1500)} />);
    expect(headerNames().slice(0, 3)).toEqual(["Кампания", "Расход", "Показы"]);

    await user.click(screen.getByRole("button", { name: "Сдвинуть столбец вправо «Расход»" }));

    expect(headerNames().slice(0, 3)).toEqual(["Кампания", "Показы", "Расход"]);
    const cells = within(screen.getByRole("row", { name: /Поиск \/ Москва/ })).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("100 000");
    expect(cells[1]).toHaveTextContent("1 000 ₽");
    const totals = within(screen.getByRole("row", { name: /Итого/ })).getAllByRole("cell");
    expect(totals[1]).toHaveTextContent("1 500 ₽");
  });

  it("moves a column back to the left", async () => {
    const user = userEvent.setup();
    render(<PerformanceTable tableKey="order-left-test" heading="Кампания" rows={rows} />);

    await user.click(screen.getByRole("button", { name: "Сдвинуть столбец влево «Показы»" }));

    expect(headerNames().slice(0, 3)).toEqual(["Кампания", "Показы", "Расход"]);
  });

  it("offers no move past either edge, and never moves the name column", () => {
    render(<PerformanceTable tableKey="order-edge-test" heading="Кампания" rows={rows} />);

    expect(screen.queryByRole("button", { name: "Сдвинуть столбец влево «Расход»" })).toBeNull();
    expect(screen.getByRole("button", { name: "Сдвинуть столбец вправо «Расход»" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сдвинуть столбец вправо «Частота»" })).toBeNull();
    expect(screen.queryByRole("button", { name: /«Кампания»/ })).toBeNull();
  });

  it("remembers the order for the table", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PerformanceTable tableKey="order-memory-test" heading="Кампания" rows={rows} />);
    await user.click(screen.getByRole("button", { name: "Сдвинуть столбец вправо «Расход»" }));

    unmount();
    const again = render(<PerformanceTable tableKey="order-memory-test" heading="Кампания" rows={rows} />);
    expect(headerNames().slice(0, 3)).toEqual(["Кампания", "Показы", "Расход"]);

    again.unmount();
    render(<PerformanceTable tableKey="order-memory-other-test" heading="Кампания" rows={rows} />);
    expect(headerNames().slice(0, 3)).toEqual(["Кампания", "Расход", "Показы"]);
  });

  it("returns a hidden column to its place when it is shown again", async () => {
    const user = userEvent.setup();
    render(<PerformanceTable tableKey="order-hidden-test" heading="Кампания" rows={rows} />);
    await user.click(screen.getByRole("button", { name: "Сдвинуть столбец вправо «Расход»" }));
    await user.click(screen.getByRole("button", { name: "Сдвинуть столбец вправо «Расход»" }));
    expect(headerNames().slice(0, 4)).toEqual(["Кампания", "Показы", "Охват", "Расход"]);

    await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Расход" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Расход" }));
    await user.keyboard("{Escape}");

    expect(headerNames().slice(0, 4)).toEqual(["Кампания", "Показы", "Охват", "Расход"]);
  });

  it("places a column the saved order does not know after the known ones", async () => {
    const user = userEvent.setup();
    const extraColumns = [{ id: "crm-new", label: "Лид (Новый)" }];
    useColumnWidths.setState({
      columnOrder: { "order-unknown-test": ["roas", "spend"] },
      visibleColumns: { "order-unknown-test": ["name", "spend", "roas", "crm-new"] },
    });
    render(<PerformanceTable tableKey="order-unknown-test" heading="Кампания" rows={rows} extraColumns={extraColumns} />);

    expect(headerNames()).toEqual(["Кампания", "ROAS", "Расход", "Лид (Новый)"]);
    await user.click(screen.getByRole("button", { name: "Сдвинуть столбец влево «Лид (Новый)»" }));
    expect(headerNames()).toEqual(["Кампания", "ROAS", "Лид (Новый)", "Расход"]);
  });
});

describe("a table limited to a number of visible rows", () => {
  const many = (count: number): PerformanceRow[] => Array.from({ length: count }, (_, index) => ({
    id: `c${index + 1}`, name: `Кампания ${index + 1}`, note: "Meta", performance: performance(index + 1),
  }));
  const campaignRows = () => screen.getAllByRole("row", { name: /^Кампания \d+/ });

  it("shows every row while they fit", () => {
    render(<PerformanceTable heading="Кампания" rows={many(10)} visibleRows={10} />);

    expect(campaignRows()).toHaveLength(10);
    expect(screen.getByRole("table")).not.toHaveAttribute("aria-rowcount");
  });

  it("renders only a window of a longer list and still tells how many rows there are", () => {
    render(<PerformanceTable heading="Кампания" rows={many(40)} visibleRows={10} totals={performance(820)} />);

    expect(campaignRows()).toHaveLength(15);
    expect(screen.getByRole("row", { name: /^Кампания 1\b/ })).toHaveAttribute("aria-rowindex", "2");
    expect(screen.queryByRole("row", { name: /^Кампания 40\b/ })).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveAttribute("aria-rowcount", "42");
    expect(screen.getByRole("row", { name: /Итого/ })).toHaveAttribute("aria-rowindex", "42");
  });

  it("moves the window along as the list scrolls", () => {
    render(<PerformanceTable heading="Кампания" rows={many(40)} visibleRows={10} />);
    const scroller = screen.getByRole("table").parentElement!;

    Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 53 * 25 });
    fireEvent.scroll(scroller);

    expect(screen.getByRole("row", { name: /^Кампания 40\b/ })).toHaveAttribute("aria-rowindex", "41");
    expect(screen.getByRole("row", { name: /^Кампания 21\b/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /^Кампания 1\b/ })).not.toBeInTheDocument();
  });

  it("opens a row that came into view by scrolling", async () => {
    const onOpen = vi.fn();
    render(<PerformanceTable heading="Кампания" rows={many(40)} visibleRows={10} onOpen={onOpen} />);
    const scroller = screen.getByRole("table").parentElement!;

    Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 53 * 30 });
    fireEvent.scroll(scroller);
    await userEvent.click(screen.getByRole("button", { name: /^Кампания 33\b/ }));

    expect(onOpen).toHaveBeenCalledWith("c33");
  });

  describe("sorting", () => {
    const sortable: PerformanceRow[] = [
      { id: "a", name: "Бета", performance: performance(300, { cpc: null }) },
      { id: "b", name: "альфа", performance: performance(100, { cpc: 2 }) },
      { id: "c", name: "Гамма", performance: performance(200, { cpc: 1 }) },
    ];
    const order = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("rowheader")[0]?.textContent ?? "").filter(Boolean);

    it("sorts by a figure column descending, ascending and back to the given order", async () => {
      const user = userEvent.setup();
      render(<PerformanceTable tableKey="sort-figures" heading="Кампания" rows={sortable} />);
      expect(order()).toEqual(["Бета", "альфа", "Гамма"]);

      await user.click(screen.getByRole("button", { name: "Расход" }));
      expect(order()).toEqual(["Бета", "Гамма", "альфа"]);
      expect(screen.getByRole("columnheader", { name: "Расход" })).toHaveAttribute("aria-sort", "descending");
      expect(screen.getByRole("columnheader", { name: "Показы" })).toHaveAttribute("aria-sort", "none");

      await user.click(screen.getByRole("button", { name: "Расход" }));
      expect(order()).toEqual(["альфа", "Гамма", "Бета"]);
      expect(screen.getByRole("columnheader", { name: "Расход" })).toHaveAttribute("aria-sort", "ascending");

      await user.click(screen.getByRole("button", { name: "Расход" }));
      expect(order()).toEqual(["Бета", "альфа", "Гамма"]);
    });

    it("sorts by the name column and keeps rows without a value last in both directions", async () => {
      const user = userEvent.setup();
      render(<PerformanceTable tableKey="sort-name" heading="Кампания" rows={sortable} />);

      await user.click(screen.getByRole("button", { name: "Кампания" }));
      expect(order()).toEqual(["Гамма", "Бета", "альфа"]);
      await user.click(screen.getByRole("button", { name: "Кампания" }));
      expect(order()).toEqual(["альфа", "Бета", "Гамма"]);

      await user.click(screen.getByRole("button", { name: "CPC" }));
      expect(order()).toEqual(["альфа", "Гамма", "Бета"]);
      await user.click(screen.getByRole("button", { name: "CPC" }));
      expect(order()).toEqual(["Гамма", "альфа", "Бета"]);
    });

    it("sorts the extra columns too", async () => {
      const user = userEvent.setup();
      render(
        <PerformanceTable
          tableKey="sort-extra"
          heading="Кампания"
          extraColumns={[{ id: "ads", label: "Объявления" }]}
          rows={[
            { id: "a", name: "Бета", performance: performance(1), extra: { ads: 9 } },
            { id: "b", name: "Альфа", performance: performance(1), extra: { ads: 2 } },
          ]}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Отображаемые столбцы" }));
      await user.click(screen.getByRole("menuitemcheckbox", { name: "Объявления" }));
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("button", { name: "Объявления" }));
      expect(order()).toEqual(["Бета", "Альфа"]);
    });

    it("orders each level among itself and leaves the totals last", async () => {
      const user = userEvent.setup();
      render(
        <PerformanceTable
          tableKey="sort-tree"
          heading="Проект"
          totals={performance(900)}
          rows={[
            {
              id: "p1", name: "Клиника", performance: performance(100),
              children: [
                { id: "k1", name: "Поиск", performance: performance(30) },
                { id: "k2", name: "Лента", performance: performance(70) },
              ],
            },
            {
              id: "p2", name: "Студия", performance: performance(800),
              children: [{ id: "k3", name: "Баннер", performance: performance(5) }],
            },
          ]}
        />,
      );
      await user.click(screen.getByRole("button", { name: /Клиника/ }));
      await user.click(screen.getByRole("button", { name: "Расход" }));

      const names = screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("rowheader")[0]?.textContent ?? "");
      expect(names).toEqual(["Студия", "Клиника", "Лента", "Поиск", "Итого"]);
      expect(within(screen.getByRole("row", { name: /Итого/ })).getByText("900 ₽")).toBeInTheDocument();
    });
  });

  describe("fitting its container", () => {
    const widthOfScroller = (width: number) =>
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);

    afterEach(() => vi.restoreAllMocks());

    it("narrows the figure columns instead of scrolling sideways when the container is too narrow", () => {
      widthOfScroller(1400);
      const { container } = render(<PerformanceTable tableKey="fit-narrow" heading="Кампания" rows={rows} />);

      const table = container.querySelector("table")!;
      expect(parseFloat(table.style.width)).toBeLessThanOrEqual(1400);
      for (const col of [...container.querySelectorAll("col")].slice(0, -1)) {
        expect(parseFloat((col as HTMLElement).style.width)).toBeGreaterThanOrEqual(40);
      }
    });

    it("widens a column at capacity by narrowing the column to its right, leaving the one to its left", async () => {
      const user = userEvent.setup();
      const handles = () => screen.getAllByRole("separator").slice(1);
      widthOfScroller(5000);
      const probe = render(<PerformanceTable tableKey="fit-push-probe" heading="Кампания" rows={rows} />);
      const figures = handles().length;
      probe.unmount();
      widthOfScroller(280 + figures * 128 + 40);
      render(<PerformanceTable tableKey="fit-push" heading="Кампания" rows={rows} />);

      handles()[1]!.focus();
      await user.keyboard("{ArrowRight}");

      expect(handles().slice(0, 3).map((handle) => handle.getAttribute("aria-valuenow"))).toEqual(["128", "138", "118"]);
    });

    it("keeps the chosen widths when the container is wide enough", () => {
      widthOfScroller(5000);
      const { container } = render(<PerformanceTable tableKey="fit-wide" heading="Кампания" rows={rows} />);

      const widths = [...container.querySelectorAll("col")].map((col) => (col as HTMLElement).style.width);
      expect(widths.slice(1, -1).every((width) => width === "128px")).toBe(true);
    });
  });
});
