import { useState } from "react";
import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import type { SummaryTile } from "@/entities/summary-tiles/index.js";

const performance = {
  spend: 1500, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, results: 75, revenue: 4000,
  ctr: 2, cpc: 0.75, cpm: 15, cpa: 30, costPerResult: 20, roas: 2.67, frequency: 2.5,
};
const range = { from: "2026-09-01", to: "2026-09-30" };
type Props = Partial<Parameters<typeof PerformanceSummary>[0]>;

function Held({ initial, ...props }: Props & { initial: SummaryTile[] }) {
  const [tiles, setTiles] = useState<SummaryTile[]>(initial);
  return <PerformanceSummary tiles={tiles} onTilesChange={setTiles} performance={performance} range={range} {...props} />;
}

const setup = (props: Props = {}) => renderWithProviders(<Held initial={["CONVERSIONS"]} {...props} />);

const projectKpi = { scope: { kind: "project" as const, id: "p1" }, canEdit: false };

const summary = () => screen.getByRole("group", { name: "Показатели за период" });
const shownTiles = () => within(summary()).queryAllByTestId("summary-tile").map((tile) => tile.getAttribute("data-tile"));

async function openDialog() {
  await userEvent.click(await screen.findByRole("button", { name: "Настроить показатели" }));
  return screen.findByRole("dialog", { name: "Показатели за период" });
}

beforeEach(() => {
  server.use(mock.get("/api/projects/:id/kpi", () => HttpResponse.json(null)));
});

describe("the period summary", () => {
  it("starts with leads and a placeholder to configure it", async () => {
    setup();

    await screen.findByRole("button", { name: "Настроить показатели" });
    expect(shownTiles()).toEqual(["CONVERSIONS"]);
    expect(within(summary()).getByText("Лиды")).toBeInTheDocument();
    expect(within(summary()).queryByText("Расход")).not.toBeInTheDocument();
  });

  it("offers a thumbnail of every tile with the period's figures and marks the chosen ones", async () => {
    setup();
    const dialog = await openDialog();

    expect(within(dialog).getByText("1/5")).toBeInTheDocument();
    const thumbnails = within(dialog).getAllByRole("button", { pressed: false }).concat(within(dialog).getAllByRole("button", { pressed: true }));
    expect(thumbnails.map((thumbnail) => thumbnail.getAttribute("aria-label")).sort()).toEqual(["CPC", "Клики", "Лиды", "Показы", "Расход", "Результаты"].sort());
    expect(within(dialog).getByRole("button", { name: "Лиды" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Лиды" })).toHaveAttribute("data-selected", "true");
    expect(within(within(dialog).getByRole("button", { name: "Расход" })).getByText("1 500 ₽")).toBeInTheDocument();
  });

  it("shows results with their cost, between leads and CPC", async () => {
    renderWithProviders(<Held initial={["CPC", "RESULTS", "CONVERSIONS"]} />);

    await waitFor(() => expect(shownTiles()).toEqual(["CONVERSIONS", "RESULTS", "CPC"]));
    const tile = within(summary()).getAllByTestId("summary-tile")[1]!;
    expect(within(tile).getByText("Результаты")).toBeInTheDocument();
    expect(within(tile).getByText("75")).toBeInTheDocument();
    expect(within(tile).getByText(/^Цена результата 20,00\s₽$/)).toBeInTheDocument();
  });

  it("adds a tile at once and shows chosen tiles in catalogue order", async () => {
    setup();
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: "Расход" }));

    expect(within(dialog).getByText("2/5")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Расход" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(shownTiles()).toEqual(["SPEND", "CONVERSIONS"]));
  });

  it("hands every change to whoever holds the tiles", async () => {
    const changes: SummaryTile[][] = [];
    renderWithProviders(
      <PerformanceSummary tiles={["CONVERSIONS"]} onTilesChange={(tiles) => changes.push(tiles)} performance={performance} range={range} kpi={projectKpi} />,
    );
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: "KPI" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Лиды" }));

    expect(changes).toEqual([["CONVERSIONS", "KPI"], []]);
  });

  it("leaves only the placeholder once every tile is removed", async () => {
    setup();
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: "Лиды" }));

    expect(within(dialog).getByText("0/5")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(shownTiles()).toEqual([]));
    expect(screen.getByRole("button", { name: "Настроить показатели" })).toBeInTheDocument();
  });

  it("stops at five tiles", async () => {
    renderWithProviders(<Held initial={["CONVERSIONS"]} kpi={projectKpi} />);
    const dialog = await openDialog();

    for (const name of ["Расход", "Показы", "Клики", "CPC"]) await userEvent.click(within(dialog).getByRole("button", { name }));

    expect(within(dialog).getByText("5/5")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "KPI" })).toBeDisabled();
    expect(within(dialog).getByText("Можно выбрать не больше 5 показателей")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Клики" }));
    expect(within(dialog).getByRole("button", { name: "KPI" })).not.toBeDisabled();
  });

  it("offers KPI only where a KPI is bound and ignores a stored tile that is not offered", async () => {
    renderWithProviders(<Held initial={["SPEND", "KPI"]} />);

    await waitFor(() => expect(shownTiles()).toEqual(["SPEND"]));
    const dialog = await openDialog();
    expect(within(dialog).queryByRole("button", { name: "KPI" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("1/5")).toBeInTheDocument();
  });

  it("shows the tiles it is given without a placeholder when nobody may change them", async () => {
    renderWithProviders(<PerformanceSummary tiles={["SPEND", "CLICKS"]} performance={performance} range={range} />);

    await waitFor(() => expect(shownTiles()).toEqual(["SPEND", "CLICKS"]));
    expect(screen.queryByRole("button", { name: "Настроить показатели" })).not.toBeInTheDocument();
  });

  it("offers KPI to a member choosing a project's tiles who cannot change the KPI itself", async () => {
    renderWithProviders(<Held initial={["CONVERSIONS"]} kpi={projectKpi} />);

    const dialog = await openDialog();
    expect(within(dialog).getByRole("button", { name: "KPI" })).toHaveAttribute("aria-pressed", "false");
  });
});

it("keeps currency amounts in one card and aggregates only nonmonetary figures", async () => {
  setup({ currency: null, currencyPerformances: [
    { currency: "USD", performance },
    { currency: "EUR", performance: { ...performance, spend: 40, cpc: 0.02, cpm: 0.4, cpa: 0.8 } },
  ] });
  expect(within(summary()).getByText("100")).toBeInTheDocument();
  const dialog = await openDialog();
  const spend = within(dialog).getByRole("button", { name: "Расход" });
  expect(within(spend).getByText("1 500 $")).toBeInTheDocument();
  expect(within(spend).getByText("40 €")).toBeInTheDocument();
  const cpc = within(dialog).getByRole("button", { name: "CPC" });
  expect(within(cpc).getByText("0,75 $")).toBeInTheDocument();
  expect(within(cpc).getByText("0,02 €")).toBeInTheDocument();
});

it("adds results up across currencies and prices them in each", async () => {
  renderWithProviders(<Held initial={["RESULTS"]} currency={null} currencyPerformances={[
    { currency: "USD", performance },
    { currency: "EUR", performance: { ...performance, costPerResult: 0.5 } },
  ]} />);

  await waitFor(() => expect(shownTiles()).toEqual(["RESULTS"]));
  expect(within(summary()).getByText("150")).toBeInTheDocument();
  expect(within(summary()).getByText(/^Цена результата 20,00\s\$$/)).toBeInTheDocument();
  expect(within(summary()).getByText(/^Цена результата 0,50\s€$/)).toBeInTheDocument();
});
