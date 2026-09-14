import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { KpiTile } from "@/features/kpi-target/index.js";

const figures = (values: Record<string, number | null> = {}) => ({
  spend: 1500, impressions: 100000, reach: 40000, clicks: 2000, conversions: 45, revenue: 4000,
  ctr: 2, cpc: 0.75, cpm: 15, cpa: 25, roas: 2.67, frequency: 2.5, ...values,
});
const firstHalf = { from: "2026-09-01", to: "2026-09-15" };
const path = "/api/projects/p1/kpi";

function kpi(initial: { metric: string; target: string } | null) {
  let current = initial && { ...initial, updatedAt: "2026-09-14T10:00:00.000Z" };
  const requests: Array<{ method: string; body?: unknown }> = [];
  server.use(
    mock.get(path, () => HttpResponse.json(current)),
    mock.put(path, async ({ request }) => {
      const body = await request.json() as { metric: string; target: string };
      requests.push({ method: "PUT", body });
      current = { metric: body.metric, target: Number(body.target).toFixed(4), updatedAt: "2026-09-14T11:00:00.000Z" };
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
