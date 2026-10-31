import { useState } from "react";
import { http as mock, HttpResponse } from "msw";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  server.use(mock.get("/api/projects/:id/kpis", () => HttpResponse.json([])));
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

  it("shows results with their cost, in the place they were given", async () => {
    renderWithProviders(<Held initial={["CPC", "RESULTS", "CONVERSIONS"]} />);

    await waitFor(() => expect(shownTiles()).toEqual(["CPC", "RESULTS", "CONVERSIONS"]));
    const tile = within(summary()).getAllByTestId("summary-tile")[1]!;
    expect(within(tile).getByText("Результаты")).toBeInTheDocument();
    expect(within(tile).getByText("75")).toBeInTheDocument();
    expect(within(tile).getByText(/^Цена результата 20,00\s₽$/)).toBeInTheDocument();
  });

  it("adds a tile at once, after the tiles already chosen", async () => {
    setup();
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: "Расход" }));

    expect(within(dialog).getByText("2/5")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Расход" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(shownTiles()).toEqual(["CONVERSIONS", "SPEND"]));
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

describe("rearranging the summary", () => {
  const handleOf = (name: string) => screen.getByRole("button", { name: `Переместить показатель: ${name}` });
  const handles = () => screen.queryAllByRole("button", { name: /^Переместить показатель/ });

  it("moves a tile one place with the arrows on its handle, keeping the focus and saying where it is", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Held initial={["SPEND", "CONVERSIONS", "CLICKS"]} />);

    handleOf("Лиды").focus();
    await user.keyboard("{ArrowLeft}");

    expect(shownTiles()).toEqual(["CONVERSIONS", "SPEND", "CLICKS"]);
    expect(handleOf("Лиды")).toHaveFocus();
    expect(screen.getByText("Лиды: место 1 из 3")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{ArrowRight}");

    expect(shownTiles()).toEqual(["SPEND", "CLICKS", "CONVERSIONS"]);
    expect(handleOf("Лиды")).toHaveFocus();
    expect(screen.getByText("Лиды: место 3 из 3")).toBeInTheDocument();
  });

  it("keeps a move in place while it is saved, then shows whatever the holder settles on", async () => {
    const user = userEvent.setup();
    let settle: (tiles: SummaryTile[]) => void = () => undefined;
    function Saving() {
      const [tiles, setTiles] = useState<SummaryTile[]>(["SPEND", "CLICKS"]);
      settle = setTiles;
      return <PerformanceSummary tiles={tiles} onTilesChange={() => undefined} performance={performance} range={range} />;
    }
    renderWithProviders(<Saving />);

    handleOf("Расход").focus();
    await user.keyboard("{ArrowRight}");
    expect(shownTiles()).toEqual(["CLICKS", "SPEND"]);

    act(() => settle(["CLICKS", "SPEND"]));
    expect(shownTiles()).toEqual(["CLICKS", "SPEND"]);

    act(() => settle(["SPEND", "CLICKS"]));
    expect(shownTiles()).toEqual(["SPEND", "CLICKS"]);
  });

  it("lets a tile be carried with the pointer and dropped without an error", async () => {
    class TestPointerEvent extends MouseEvent {
      readonly isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.isPrimary = init.isPrimary ?? true;
      }
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    renderWithProviders(<Held initial={["SPEND", "CLICKS"]} />);
    const tile = within(summary()).getAllByTestId("summary-tile")[0]!;
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener("error", onError);

    fireEvent.pointerDown(tile, { isPrimary: true, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 40, clientY: 10 });
    await waitFor(() => expect(tile).toHaveAttribute("data-dragging", "true"));
    fireEvent.pointerUp(document, { clientX: 40, clientY: 10 });

    await waitFor(() => expect(tile).not.toHaveAttribute("data-dragging"));
    window.removeEventListener("error", onError);
    vi.unstubAllGlobals();
    expect(errors).toEqual([]);
    expect(shownTiles()).toHaveLength(2);
  });

  it("hands over nothing at either end, and the new order otherwise", async () => {
    const user = userEvent.setup();
    const changes: SummaryTile[][] = [];
    renderWithProviders(
      <PerformanceSummary tiles={["SPEND", "CLICKS"]} onTilesChange={(tiles) => changes.push(tiles)} performance={performance} range={range} />,
    );

    handleOf("Расход").focus();
    await user.keyboard("{ArrowLeft}{ArrowUp}");
    handleOf("Клики").focus();
    await user.keyboard("{ArrowRight}{ArrowLeft}");

    expect(changes).toEqual([["CLICKS", "SPEND"]]);
  });

  it("moves a project's KPI as one, with every card it holds", async () => {
    const user = userEvent.setup();
    server.use(mock.get("/api/projects/:id/kpis", () => HttpResponse.json(["CONVERSIONS", "CPA"].map((metric, index) => ({
      id: `k${index}`, metric, target: "60.0000", enabled: true, account: null, updatedAt: "2026-09-14T10:00:00.000Z",
    })))));
    renderWithProviders(<Held initial={["KPI", "SPEND"]} kpi={projectKpi} />);

    await waitFor(() => expect(shownTiles()).toEqual(["KPI", "KPI", "SPEND"]));
    const kpiHandles = screen.getAllByRole("button", { name: "Переместить показатель: KPI" });
    expect(kpiHandles).toHaveLength(2);

    kpiHandles[1]!.focus();
    await user.keyboard("{ArrowRight}");

    expect(shownTiles()).toEqual(["SPEND", "KPI", "KPI"]);
    expect(screen.getByText("KPI: место 2 из 2")).toBeInTheDocument();
  });

  it("offers no handle where the summary cannot change, with a single tile or in the dialog", async () => {
    const { unmount } = renderWithProviders(<PerformanceSummary tiles={["SPEND", "CLICKS"]} performance={performance} range={range} />);
    await waitFor(() => expect(shownTiles()).toEqual(["SPEND", "CLICKS"]));
    expect(handles()).toEqual([]);
    unmount();

    renderWithProviders(<Held initial={["CONVERSIONS"]} />);
    await screen.findByRole("button", { name: "Настроить показатели" });
    expect(handles()).toEqual([]);
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Расход" }));

    expect(within(dialog).queryAllByRole("button", { name: /^Переместить показатель/ })).toEqual([]);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(handles()).toHaveLength(2));
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
