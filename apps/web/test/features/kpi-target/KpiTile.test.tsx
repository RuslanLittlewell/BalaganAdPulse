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
const path = "/api/projects/p1/kpi";

type StoredKpi = { metric: string; target: string; name?: string; value?: string };

function kpi(initial: StoredKpi | null) {
  let current = initial && { ...initial, updatedAt: "2026-09-14T10:00:00.000Z" };
  const requests: Array<{ method: string; body?: unknown }> = [];
  server.use(
    mock.get(path, () => HttpResponse.json(current)),
    mock.put(path, async ({ request }) => {
      const body = await request.json() as StoredKpi;
      requests.push({ method: "PUT", body });
      current = {
        ...body,
        target: Number(body.target).toFixed(4),
        ...(body.value === undefined ? {} : { value: Number(body.value).toFixed(4) }),
        updatedAt: "2026-09-14T11:00:00.000Z",
      };
      return HttpResponse.json(current);
    }),
    mock.delete(path, () => { requests.push({ method: "DELETE" }); current = null; return new HttpResponse(null, { status: 204 }); }),
  );
  return requests;
}

const setup = (props: { canEdit?: boolean; values?: Record<string, number | null>; preview?: boolean } = {}) =>
  renderWithProviders(
    <KpiTile scope={{ kind: "project", id: "p1" }} canEdit={props.canEdit ?? true} figures={figures(props.values)}
      range={firstHalf} currency="BYN" preview={props.preview} />,
  );

const tile = () => screen.getByTestId("kpi-tile");

describe("the KPI tile", () => {
  it("shows an exceeded KPI with its actual figure, period target, percent, progress and Выполнено+", async () => {
    kpi({ metric: "CONVERSIONS", target: "60.0000" });
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
    kpi({ metric: "CONVERSIONS", target: "60.0000" });
    setup({ values: { conversions: 30 } });

    expect(await screen.findByText("Цель 30 · 100%")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "met");
    expect(within(tile()).getByText("Выполнено")).toBeInTheDocument();
    expect(within(tile()).queryByText("Выполнено+")).not.toBeInTheDocument();
  });

  it("writes no status for a lower-is-better KPI falling behind", async () => {
    kpi({ metric: "CPA", target: "20.0000" });
    setup();

    expect(await screen.findByText("KPI · CPL")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "behind");
    expect(within(tile()).getByText(/^25,00\sBr$/)).toBeInTheDocument();
    expect(within(tile()).getByText(/^Цель 20,00\sBr · 80%$/)).toBeInTheDocument();
    expect(within(tile()).queryByText(/Выполнено|Отстаёт/)).not.toBeInTheDocument();
    expect(within(tile()).getByRole("progressbar", { name: "Выполнение KPI" })).toHaveAttribute("aria-valuenow", "80");
  });

  it("shows no figure, progress or status when the KPI cannot be measured for the period", async () => {
    kpi({ metric: "CPA", target: "20.0000" });
    setup({ values: { cpa: null } });

    await screen.findByText("KPI · CPL");
    expect(tile()).toHaveAttribute("data-state", "unmeasured");
    expect(within(tile()).getByText("—")).toBeInTheDocument();
    expect(within(tile()).queryByText(/Выполнено|Нет данных/)).not.toBeInTheDocument();
    expect(within(tile()).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("offers to set a target only to members who may", async () => {
    kpi(null);
    const { unmount } = setup();

    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Задать цель" })).toBeInTheDocument();
    unmount();

    setup({ canEdit: false });
    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Задать цель" })).not.toBeInTheDocument();
  });

  it("keeps a thumbnail free of controls", async () => {
    kpi(null);
    setup({ preview: true });

    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("the KPI target dialog", () => {
  it("sets a monthly target and shows it on the tile", async () => {
    const requests = kpi(null);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Задать цель" }));
    const dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    await userEvent.click(within(dialog).getByLabelText("Метрика"));
    await userEvent.click(await screen.findByRole("option", { name: "Лиды" }));
    expect(within(dialog).getByText("Цель на месяц, пересчитывается на выбранный период")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Цель"), "60");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(requests).toEqual([{ method: "PUT", body: { metric: "CONVERSIONS", target: "60" } }]));
    expect(await screen.findByText("KPI · Лиды")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains that a ratio target applies as it is and accepts a decimal comma", async () => {
    const requests = kpi(null);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Задать цель" }));
    const dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    await userEvent.click(within(dialog).getByLabelText("Метрика"));
    await userEvent.click(await screen.findByRole("option", { name: "CPL" }));
    expect(within(dialog).getByText("Целевое значение, сравнивается с показателем периода как есть")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Цель"), "20,5");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(requests).toEqual([{ method: "PUT", body: { metric: "CPA", target: "20.5" } }]));
  });

  it("replaces an existing target, starting from its values", async () => {
    const requests = kpi({ metric: "CONVERSIONS", target: "60.0000" });
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Изменить цель" }));
    const dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    expect(within(dialog).getByLabelText("Метрика")).toHaveTextContent("Лиды");
    const target = within(dialog).getByLabelText("Цель");
    expect(target).toHaveValue("60");
    await userEvent.clear(target);
    await userEvent.type(target, "90");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(requests).toEqual([{ method: "PUT", body: { metric: "CONVERSIONS", target: "90" } }]));
    expect(await screen.findByText("Цель 45 · 100%")).toBeInTheDocument();
  });

  it("clears a target", async () => {
    const requests = kpi({ metric: "CONVERSIONS", target: "60.0000" });
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Изменить цель" }));
    const dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Удалить цель" }));

    await waitFor(() => expect(requests).toEqual([{ method: "DELETE" }]));
    expect(await screen.findByText("Цель не задана")).toBeInTheDocument();
  });

  it("refuses a target that is not a positive number", async () => {
    const requests = kpi(null);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Задать цель" }));
    const dialog = await screen.findByRole("dialog", { name: "Цель KPI" });
    await userEvent.type(within(dialog).getByLabelText("Цель"), "0");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    expect(await within(dialog).findByText("Введите положительное число, не больше 4 знаков после запятой")).toBeInTheDocument();
    expect(requests).toEqual([]);
  });
});

describe("a KPI set by hand", () => {
  const openDialog = async (button = "Задать цель") => {
    await userEvent.click(await screen.findByRole("button", { name: button }));
    return screen.findByRole("dialog", { name: "Цель KPI" });
  };
  const chooseManual = async (dialog: HTMLElement) => {
    await userEvent.click(within(dialog).getByLabelText("Метрика"));
    await userEvent.click(await screen.findByRole("option", { name: "Вручную" }));
  };

  it("asks for a name, a value and a target, and saves them", async () => {
    const requests = kpi(null);
    setup();

    const dialog = await openDialog();
    expect(within(dialog).queryByLabelText("Название")).not.toBeInTheDocument();
    await chooseManual(dialog);
    expect(within(dialog).getByText("Значение и цель меняются только вручную и не зависят от выбранного периода"))
      .toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Название"), " Продажи ");
    await userEvent.type(within(dialog).getByLabelText("Значение"), "30,5");
    await userEvent.type(within(dialog).getByLabelText("Цель"), "50");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: { metric: "MANUAL", name: "Продажи", value: "30.5", target: "50" } },
    ]));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says what is missing and sends nothing", async () => {
    const requests = kpi(null);
    setup();

    const dialog = await openDialog();
    await chooseManual(dialog);
    await userEvent.type(within(dialog).getByLabelText("Значение"), "-3");
    await userEvent.type(within(dialog).getByLabelText("Цель"), "0");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    expect(await within(dialog).findByText("Введите название")).toBeInTheDocument();
    expect(within(dialog).getByText("Введите число не меньше нуля, не больше 4 знаков после запятой")).toBeInTheDocument();
    expect(within(dialog).getByText("Введите положительное число, не больше 4 знаков после запятой")).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it("shows its name, value, target and progress on the tile, whatever the figures", async () => {
    kpi({ metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" });
    setup({ canEdit: false, values: { conversions: 999 } });

    expect(await screen.findByText("KPI · Продажи")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "behind");
    expect(within(tile()).getByText("30")).toBeInTheDocument();
    expect(within(tile()).getByText("Цель 50 · 60%")).toBeInTheDocument();
    expect(within(tile()).getByRole("progressbar", { name: "Выполнение KPI" })).toHaveAttribute("aria-valuenow", "60");
  });

  it("writes Выполнено once the value reaches the target", async () => {
    kpi({ metric: "MANUAL", name: "Продажи", value: "50.0000", target: "50.0000" });
    setup({ canEdit: false });

    expect(await within(await screen.findByTestId("kpi-tile")).findByText("Выполнено")).toBeInTheDocument();
    expect(tile()).toHaveAttribute("data-state", "met");
  });

  it("opens for editing with Вручную chosen and its fields filled", async () => {
    const requests = kpi({ metric: "MANUAL", name: "Продажи", value: "30.0000", target: "50.0000" });
    setup();

    const dialog = await openDialog("Изменить цель");
    expect(within(dialog).getByLabelText("Метрика")).toHaveTextContent("Вручную");
    expect(within(dialog).getByLabelText("Название")).toHaveValue("Продажи");
    expect(within(dialog).getByLabelText("Значение")).toHaveValue("30");
    expect(within(dialog).getByLabelText("Цель")).toHaveValue("50");
    await userEvent.clear(within(dialog).getByLabelText("Значение"));
    await userEvent.type(within(dialog).getByLabelText("Значение"), "42");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(requests).toEqual([
      { method: "PUT", body: { metric: "MANUAL", name: "Продажи", value: "42", target: "50" } },
    ]));
  });

  it.each([
    ["campaign", { kind: "campaign" as const, id: "c1" }, "/api/campaigns/c1/kpi"],
    ["organization", { kind: "organization" as const }, "/api/organization/kpi"],
  ])("is not offered for the %s", async (_level, scope, path) => {
    server.use(mock.get(path, () => HttpResponse.json(null)));
    renderWithProviders(
      <KpiTile scope={scope} canEdit figures={figures()} range={firstHalf} currency="BYN" />,
    );

    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByLabelText("Метрика"));

    expect(await screen.findByRole("option", { name: "Лиды" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Вручную" })).not.toBeInTheDocument();
  });
});

it("shows monetary KPI values by currency inside one tile", async () => {
  kpi({ metric: "CPA", target: "20.0000" });
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
