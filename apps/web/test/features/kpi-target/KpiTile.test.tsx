import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { KpiTile } from "@/features/kpi-target/index.js";

const figures = (values: Record<string, number | null> = {}) => ({
  spend: 1500, impressions: 100000, reach: 40000, clicks: 2000, conversions: 45, results: 75, revenue: 4000,
  ctr: 2, cpc: 0.75, cpm: 15, cpa: 25, costPerResult: 20, roas: 2.67, frequency: 2.5, ...values,
});
const firstHalf = { from: "2026-09-01", to: "2026-09-15" };
const path = "/api/projects/p1/kpis";

type StoredKpi = { metric: string; target: string; name?: string; value?: string; enabled?: boolean };

function kpis(initial: StoredKpi[]) {
  const stamp = (list: StoredKpi[]) => list.map((entry, index) => ({
    enabled: true, ...entry, id: `k${index}`, updatedAt: "2026-09-14T10:00:00.000Z",
  }));
  let current = stamp(initial);
  const requests: Array<{ method: string; body?: unknown }> = [];
  server.use(
    mock.get(path, () => HttpResponse.json(current)),
    mock.put(path, async ({ request }) => {
      const body = await request.json() as StoredKpi[];
      requests.push({ method: "PUT", body });
      current = stamp(body.map((entry) => ({
        ...entry,
        target: Number(entry.target).toFixed(4),
        ...(entry.value === undefined ? {} : { value: Number(entry.value).toFixed(4) }),
      })));
      return HttpResponse.json(current);
    }),
  );
  return requests;
}

const setup = (props: { canEdit?: boolean; values?: Record<string, number | null>; preview?: boolean } = {}) =>
  renderWithProviders(
    <KpiTile scope={{ kind: "project", id: "p1" }} canEdit={props.canEdit ?? true} figures={figures(props.values)}
      range={firstHalf} currency="BYN" preview={props.preview} />,
  );

const tile = () => screen.getByTestId("kpi-tile");
const tiles = () => screen.getAllByTestId("kpi-tile");

describe("the KPI tile", () => {
  it("shows an exceeded KPI with its actual figure, period target, percent, progress and Выполнено+", async () => {
    kpis([{ metric: "CONVERSIONS", target: "60.0000" }]);
    setup({ canEdit: false });

    expect(await screen.findByText("KPI · Лиды")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "exceeded");
    expect(within(tile()).getByText("45")).toBeInTheDocument();
    expect(within(tile()).getByText("Цель 30 · 150%")).toBeInTheDocument();
    expect(within(tile()).getByText("Выполнено+")).toBeInTheDocument();
    expect(within(tile()).queryByText("Выполнено")).not.toBeInTheDocument();
    expect(within(tile()).getByRole("progressbar", { name: "Выполнение KPI" })).toHaveAttribute("aria-valuenow", "100");
    expect(within(tile()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("writes Выполнено for a KPI met exactly", async () => {
    kpis([{ metric: "CONVERSIONS", target: "60.0000" }]);
    setup({ values: { conversions: 30 } });

    expect(await screen.findByText("Цель 30 · 100%")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "met");
    expect(within(tile()).getByText("Выполнено")).toBeInTheDocument();
    expect(within(tile()).queryByText("Выполнено+")).not.toBeInTheDocument();
  });

  it("writes no status for a lower-is-better KPI falling behind", async () => {
    kpis([{ metric: "CPA", target: "20.0000" }]);
    setup();

    expect(await screen.findByText("KPI · CPL")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "behind");
    expect(within(tile()).getByText(/^25,00\sBr$/)).toBeInTheDocument();
    expect(within(tile()).getByText(/^Цель 20,00\sBr · 80%$/)).toBeInTheDocument();
    expect(within(tile()).queryByText(/Выполнено|Отстаёт/)).not.toBeInTheDocument();
    expect(within(tile()).getByRole("progressbar", { name: "Выполнение KPI" })).toHaveAttribute("aria-valuenow", "80");
  });

  it("shows no figure, progress or status when the KPI cannot be measured for the period", async () => {
    kpis([{ metric: "CPA", target: "20.0000" }]);
    setup({ values: { cpa: null } });

    await screen.findByText("KPI · CPL");
    expect(tile()).toHaveAttribute("data-state", "unmeasured");
    expect(within(tile()).getByText("—")).toBeInTheDocument();
    expect(within(tile()).queryByText(/Выполнено|Нет данных/)).not.toBeInTheDocument();
    expect(within(tile()).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("offers to set a target only to members who may", async () => {
    kpis([]);
    const { unmount } = setup();

    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Задать цель" })).toBeInTheDocument();
    unmount();

    setup({ canEdit: false });
    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Задать цель" })).not.toBeInTheDocument();
  });

  it("keeps a thumbnail free of controls and shows only the first KPI", async () => {
    kpis([{ metric: "CONVERSIONS", target: "60.0000" }, { metric: "CPA", target: "20.0000" }]);
    setup({ preview: true });

    expect(await screen.findByText("KPI · Лиды")).toBeInTheDocument();
    expect(tiles()).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps an empty thumbnail free of controls", async () => {
    kpis([]);
    setup({ preview: true });

    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("a project with several KPIs", () => {
  it("shows one tile for each KPI, in order", async () => {
    kpis([{ metric: "CONVERSIONS", target: "60.0000" }, { metric: "CPA", target: "20.0000" }, { metric: "SPEND", target: "2000.0000" }]);
    setup({ canEdit: false });

    await waitFor(() => expect(tiles()).toHaveLength(3));
    expect(tiles().map((entry) => within(entry).getByText(/^KPI · /).textContent)).toEqual(["KPI · Лиды", "KPI · CPL", "KPI · Расход"]);
    expect(screen.getAllByTestId("summary-tile")).toHaveLength(3);
  });

  it("draws a green circle on a KPI that counts and a grey one on a KPI that is switched off, without dimming it", async () => {
    kpis([
      { metric: "CONVERSIONS", target: "60.0000" },
      { metric: "CONVERSIONS", target: "60.0000", enabled: false },
    ]);
    setup({ canEdit: false });

    await waitFor(() => expect(tiles()).toHaveLength(2));
    const [counted, off] = tiles();
    expect(counted).toHaveAttribute("data-enabled", "true");
    expect(within(counted!).getByRole("img", { name: "Учитывается в результате проекта" })).toBeInTheDocument();
    expect(off).toHaveAttribute("data-enabled", "false");
    expect(within(off!).getByRole("img", { name: "Не учитывается в результате проекта" })).toBeInTheDocument();
    expect(within(off!).getByText("Выполнено+")).toBeInTheDocument();
    expect(within(off!).getByText("Цель 30 · 150%")).toBeInTheDocument();
  });

  it("offers the dialog on every tile of a member who may change the KPIs", async () => {
    kpis([{ metric: "CONVERSIONS", target: "60.0000" }, { metric: "CPA", target: "20.0000" }]);
    setup();

    await waitFor(() => expect(tiles()).toHaveLength(2));
    expect(screen.getAllByRole("button", { name: "Изменить цель" })).toHaveLength(2);
  });
});

describe("the KPI dialog of a project", () => {
  const open = async (button = "Задать цель", index = 0) => {
    await userEvent.click((await screen.findAllByRole("button", { name: button }))[index]!);
    return screen.findByRole("dialog", { name: "Цель KPI" });
  };
  const block = (dialog: HTMLElement, position: number) => within(dialog).getByRole("group", { name: `KPI ${position}` });
  const choose = async (scope: HTMLElement, metric: string) => {
    await userEvent.click(within(scope).getByLabelText("Метрика"));
    await userEvent.click(await screen.findByRole("option", { name: metric }));
  };
  const save = (dialog: HTMLElement) => userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

  it("starts a project without a KPI with one empty block", async () => {
    kpis([]);
    setup();

    const dialog = await open();
    expect(within(dialog).getAllByRole("group")).toHaveLength(1);
    expect(within(block(dialog, 1)).getByLabelText("Цель")).toHaveValue("");
    expect(within(block(dialog, 1)).queryByRole("button", { name: /Удалить KPI/ })).not.toBeInTheDocument();
  });

  it("previews each block as the tile it will become, following what is typed and the switch", async () => {
    kpis([]);
    setup();

    const dialog = await open();
    const preview = () => within(block(dialog, 1)).getByTestId("kpi-preview");
    expect(preview()).toHaveTextContent("Цель не задана");

    await userEvent.type(within(block(dialog, 1)).getByLabelText("Цель"), "60");
    expect(preview()).toHaveTextContent("KPI · Лиды");
    expect(preview()).toHaveTextContent("Цель 30 · 150%");
    expect(within(preview()).getByText("Выполнено+")).toBeInTheDocument();
    expect(within(preview()).getByRole("img", { name: "Учитывается в результате проекта" })).toBeInTheDocument();

    await userEvent.click(within(block(dialog, 1)).getByRole("switch", { name: "Учитывать в результате" }));
    expect(preview()).toHaveAttribute("data-enabled", "false");
    expect(within(preview()).getByRole("img", { name: "Не учитывается в результате проекта" })).toBeInTheDocument();
    expect(within(preview()).getByText("Выполнено+")).toBeInTheDocument();
    expect(screen.queryAllByTestId("kpi-tile")).not.toContain(preview());
  });

  it("sets a monthly target and shows it on the tile", async () => {
    const requests = kpis([]);
    setup();

    const dialog = await open();
    await choose(block(dialog, 1), "Лиды");
    expect(within(dialog).getByText("Цель на месяц, пересчитывается на выбранный период")).toBeInTheDocument();
    await userEvent.type(within(block(dialog, 1)).getByLabelText("Цель"), "60");
    await save(dialog);

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: [{ metric: "CONVERSIONS", target: "60", enabled: true }] },
    ]));
    expect(await screen.findByText("KPI · Лиды")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains that a ratio target applies as it is and accepts a decimal comma", async () => {
    const requests = kpis([]);
    setup();

    const dialog = await open();
    await choose(block(dialog, 1), "CPL");
    expect(within(dialog).getByText("Целевое значение, сравнивается с показателем периода как есть")).toBeInTheDocument();
    await userEvent.type(within(block(dialog, 1)).getByLabelText("Цель"), "20,5");
    await save(dialog);

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: [{ metric: "CPA", target: "20.5", enabled: true }] },
    ]));
  });

  it("lists the KPIs as blocks starting from their values, with a plus control after them", async () => {
    kpis([{ metric: "CONVERSIONS", target: "60.0000" }, { metric: "CPA", target: "20.0000", enabled: false }]);
    setup();

    await screen.findAllByTestId("kpi-tile");
    const dialog = await open("Изменить цель");
    expect(within(dialog).getAllByRole("group")).toHaveLength(2);
    expect(within(block(dialog, 1)).getByLabelText("Метрика")).toHaveTextContent("Лиды");
    expect(within(block(dialog, 1)).getByLabelText("Цель")).toHaveValue("60");
    expect(within(block(dialog, 1)).getByRole("switch", { name: "Учитывать в результате" })).toBeChecked();
    expect(within(block(dialog, 2)).getByLabelText("Метрика")).toHaveTextContent("CPL");
    expect(within(block(dialog, 2)).getByRole("switch", { name: "Учитывать в результате" })).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Добавить KPI" })).toBeEnabled();
  });

  it("adds a block only when the plus control is pressed, and saves them in order", async () => {
    const requests = kpis([{ metric: "CONVERSIONS", target: "60.0000" }]);
    setup();

    await screen.findByText("KPI · Лиды");
    const dialog = await open("Изменить цель");
    expect(within(dialog).getAllByRole("group")).toHaveLength(1);

    await userEvent.click(within(dialog).getByRole("button", { name: "Добавить KPI" }));
    expect(within(dialog).getAllByRole("group")).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Добавить KPI" })).toBeDisabled();
    await choose(block(dialog, 2), "CPL");
    await userEvent.type(within(block(dialog, 2)).getByLabelText("Цель"), "20");
    expect(within(dialog).getAllByRole("group")).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Добавить KPI" })).toBeEnabled();
    await save(dialog);

    await waitFor(() => expect(requests).toEqual([{ method: "PUT", body: [
      { metric: "CONVERSIONS", target: "60", enabled: true },
      { metric: "CPA", target: "20", enabled: true },
    ] }]));
    await waitFor(() => expect(tiles()).toHaveLength(2));
  });

  it("offers no plus control once the project holds five KPIs", async () => {
    kpis(Array.from({ length: 5 }, () => ({ metric: "CONVERSIONS", target: "10.0000" })));
    setup();

    await screen.findAllByTestId("kpi-tile");
    const dialog = await open("Изменить цель");
    expect(within(dialog).getAllByRole("group")).toHaveLength(5);
    expect(within(dialog).queryByRole("button", { name: "Добавить KPI" })).not.toBeInTheDocument();
  });

  it("stops offering the plus control at the fifth block", async () => {
    kpis([]);
    setup();

    const dialog = await open();
    for (let position = 1; position <= 4; position += 1) {
      await userEvent.type(within(block(dialog, position)).getByLabelText("Цель"), "10");
      await userEvent.click(within(dialog).getByRole("button", { name: "Добавить KPI" }));
    }

    expect(within(dialog).getAllByRole("group")).toHaveLength(5);
    expect(within(block(dialog, 5)).getByLabelText("Цель")).toHaveValue("");
    expect(within(dialog).queryByRole("button", { name: "Добавить KPI" })).not.toBeInTheDocument();
  });

  it("saves a KPI switched off", async () => {
    const requests = kpis([{ metric: "CONVERSIONS", target: "60.0000" }]);
    setup();

    await screen.findByText("KPI · Лиды");
    const dialog = await open("Изменить цель");
    await userEvent.click(within(block(dialog, 1)).getByRole("switch", { name: "Учитывать в результате" }));
    await save(dialog);

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: [{ metric: "CONVERSIONS", target: "60", enabled: false }] },
    ]));
    await waitFor(() => expect(tile()).toHaveAttribute("data-enabled", "false"));
  });

  it("removes a block and its KPI on saving", async () => {
    const requests = kpis([{ metric: "CONVERSIONS", target: "60.0000" }, { metric: "CPA", target: "20.0000" }]);
    setup();

    await waitFor(() => expect(tiles()).toHaveLength(2));
    const dialog = await open("Изменить цель");
    await userEvent.click(within(block(dialog, 1)).getByRole("button", { name: "Удалить KPI 1" }));
    expect(within(dialog).getAllByRole("group")).toHaveLength(1);
    await save(dialog);

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: [{ metric: "CPA", target: "20", enabled: true }] },
    ]));
    await waitFor(() => expect(tiles()).toHaveLength(1));
  });

  it("clears every KPI when every block is removed", async () => {
    const requests = kpis([{ metric: "CONVERSIONS", target: "60.0000" }]);
    setup();

    await screen.findByText("KPI · Лиды");
    const dialog = await open("Изменить цель");
    await userEvent.click(within(block(dialog, 1)).getByRole("button", { name: "Удалить KPI 1" }));
    await save(dialog);

    await waitFor(() => expect(requests).toEqual([{ method: "PUT", body: [] }]));
    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
  });

  it("ignores an empty block on saving", async () => {
    const requests = kpis([{ metric: "CONVERSIONS", target: "60.0000" }]);
    setup();

    await screen.findByText("KPI · Лиды");
    const dialog = await open("Изменить цель");
    await userEvent.click(within(dialog).getByRole("button", { name: "Добавить KPI" }));
    await save(dialog);

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: [{ metric: "CONVERSIONS", target: "60", enabled: true }] },
    ]));
  });

  it("refuses a target that is not a positive number and sends nothing", async () => {
    const requests = kpis([]);
    setup();

    const dialog = await open();
    await userEvent.type(within(block(dialog, 1)).getByLabelText("Цель"), "0");
    await save(dialog);

    expect(await within(dialog).findByText("Введите положительное число, не больше 4 знаков после запятой")).toBeInTheDocument();
    expect(requests).toEqual([]);
  });
});

describe("a KPI set by hand", () => {
  const openDialog = async (button = "Задать цель") => {
    await userEvent.click((await screen.findAllByRole("button", { name: button }))[0]!);
    return screen.findByRole("dialog", { name: "Цель KPI" });
  };
  const first = (dialog: HTMLElement) => within(dialog).getByRole("group", { name: "KPI 1" });
  const chooseManual = async (dialog: HTMLElement) => {
    await userEvent.click(within(first(dialog)).getByLabelText("Метрика"));
    await userEvent.click(await screen.findByRole("option", { name: "Вручную" }));
  };

  it("asks for a name, a value and a target, and saves them", async () => {
    const requests = kpis([]);
    setup();

    const dialog = await openDialog();
    expect(within(dialog).queryByLabelText("Название")).not.toBeInTheDocument();
    await chooseManual(dialog);
    expect(within(dialog).getByText("Значение и цель меняются только вручную и не зависят от выбранного периода"))
      .toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Название"), " Продажи ");
    await userEvent.type(within(dialog).getByLabelText("Значение"), "30,5");
    await userEvent.type(within(first(dialog)).getByLabelText("Цель"), "50");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: [{ metric: "MANUAL", name: "Продажи", value: "30.5", target: "50", enabled: true }] },
    ]));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says what is missing and sends nothing", async () => {
    const requests = kpis([]);
    setup();

    const dialog = await openDialog();
    await chooseManual(dialog);
    await userEvent.type(within(dialog).getByLabelText("Значение"), "-3");
    await userEvent.type(within(first(dialog)).getByLabelText("Цель"), "0");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    expect(await within(dialog).findByText("Введите название")).toBeInTheDocument();
    expect(within(dialog).getByText("Введите число не меньше нуля, не больше 4 знаков после запятой")).toBeInTheDocument();
    expect(within(dialog).getByText("Введите положительное число, не больше 4 знаков после запятой")).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it("shows its name, value, target and progress on the tile, whatever the figures", async () => {
    kpis([{ metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" }]);
    setup({ canEdit: false, values: { conversions: 999 } });

    expect(await screen.findByText("KPI · Продажи")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "behind");
    expect(within(tile()).getByText("30")).toBeInTheDocument();
    expect(within(tile()).getByText("Цель 50 · 60%")).toBeInTheDocument();
    expect(within(tile()).getByRole("progressbar", { name: "Выполнение KPI" })).toHaveAttribute("aria-valuenow", "60");
  });

  it("writes Выполнено once the value reaches the target", async () => {
    kpis([{ metric: "MANUAL", name: "Продажи", value: "50.0000", target: "50.0000" }]);
    setup({ canEdit: false });

    expect(await screen.findByText("Выполнено")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "met");
  });

  it("opens for editing with Вручную chosen and its fields filled", async () => {
    const requests = kpis([{ metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" }]);
    setup();

    await screen.findByText("KPI · Продажи");
    const dialog = await openDialog("Изменить цель");
    expect(within(first(dialog)).getByLabelText("Метрика")).toHaveTextContent("Вручную");
    expect(within(dialog).getByLabelText("Название")).toHaveValue("Продажи");
    expect(within(dialog).getByLabelText("Значение")).toHaveValue("30");
    expect(within(first(dialog)).getByLabelText("Цель")).toHaveValue("50");
    await userEvent.clear(within(dialog).getByLabelText("Значение"));
    await userEvent.type(within(dialog).getByLabelText("Значение"), "42");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: [{ metric: "MANUAL", name: "Продажи", value: "42", target: "50", enabled: true }] },
    ]));
  });
});

describe("the KPI of a campaign or the organization", () => {
  const levels = [
    ["campaign", { kind: "campaign" as const, id: "c1" }, "/api/campaigns/c1/kpi"],
    ["organization", { kind: "organization" as const }, "/api/organization/kpi"],
  ] as const;

  it.each(levels)("is one target set in a plain dialog without Вручную for the %s", async (_level, scope, path) => {
    server.use(mock.get(path, () => HttpResponse.json(null)));
    renderWithProviders(<KpiTile scope={scope} canEdit figures={figures()} range={firstHalf} currency="BYN" />);

    await userEvent.click(await screen.findByRole("button", { name: "Задать цель" }));
    const dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText("Метрика"));

    expect(await screen.findByRole("option", { name: "Лиды" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Вручную" })).not.toBeInTheDocument();
  });

  it("is set, replaced and cleared as before", async () => {
    let current: { metric: string; target: string; updatedAt: string } | null = null;
    const requests: Array<{ method: string; body?: unknown }> = [];
    server.use(
      mock.get("/api/campaigns/c1/kpi", () => HttpResponse.json(current)),
      mock.put("/api/campaigns/c1/kpi", async ({ request }) => {
        const body = await request.json() as { metric: string; target: string };
        requests.push({ method: "PUT", body });
        current = { ...body, target: Number(body.target).toFixed(4), updatedAt: "2026-09-14T11:00:00.000Z" };
        return HttpResponse.json(current);
      }),
      mock.delete("/api/campaigns/c1/kpi", () => { requests.push({ method: "DELETE" }); current = null; return new HttpResponse(null, { status: 204 }); }),
    );
    renderWithProviders(<KpiTile scope={{ kind: "campaign", id: "c1" }} canEdit figures={figures()} range={firstHalf} currency="BYN" />);

    await userEvent.click(await screen.findByRole("button", { name: "Задать цель" }));
    let dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    await userEvent.type(within(dialog).getByLabelText("Цель"), "60");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(requests).toEqual([{ method: "PUT", body: { metric: "CONVERSIONS", target: "60" } }]));
    expect(await screen.findByText("KPI · Лиды")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Изменить цель" }));
    dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Удалить цель" }));
    await waitFor(() => expect(requests.at(-1)).toEqual({ method: "DELETE" }));
    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
  });
});

it("shows monetary KPI values by currency inside one tile", async () => {
  kpis([{ metric: "CPA", target: "20.0000" }]);
  renderWithProviders(<KpiTile scope={{ kind: "project", id: "p1" }} canEdit={false} figures={figures()}
    range={firstHalf} currency={null} currencyFigures={[
      { currency: "USD", performance: figures({ cpa: 10 }) },
      { currency: "EUR", performance: figures({ cpa: 25 }) },
    ]} />);
  expect(await screen.findByText("10,00 $")).toBeInTheDocument();
  expect(screen.getByText("25,00 €")).toBeInTheDocument();
  expect(screen.getAllByTestId("kpi-tile")).toHaveLength(1);
  expect(within(tile()).getAllByRole("progressbar")).toHaveLength(2);
});
