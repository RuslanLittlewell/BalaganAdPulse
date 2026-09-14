import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { PerformanceSummary } from "@/widgets/agency-overview/index.js";
import { useSummaryTiles } from "@/widgets/agency-overview/summaryTiles.js";

const performance = {
  spend: 1500, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50, revenue: 4000,
  ctr: 2, cpc: 0.75, cpm: 15, cpa: 30, roas: 2.67, frequency: 2.5,
};
const range = { from: "2026-09-01", to: "2026-09-30" };
type Props = Partial<Parameters<typeof PerformanceSummary>[0]>;

const setup = (props: Props = {}) =>
  renderWithProviders(<PerformanceSummary screen="dashboard" performance={performance} range={range} {...props} />);

const summary = () => screen.getByRole("group", { name: "Показатели за период" });
const shownTiles = () => within(summary()).queryAllByTestId("summary-tile").map((tile) => tile.getAttribute("data-tile"));

async function openDialog() {
  await userEvent.click(await screen.findByRole("button", { name: "Настроить показатели" }));
  return screen.findByRole("dialog", { name: "Показатели за период" });
}

const signedInAs = (id: string) => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id, name: "Buyer", email: `${id}@acme.com`, image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "ADMIN",
  clientIds: [],
})));

beforeEach(() => {
  server.use(mock.get("/api/projects/:id/kpi", () => HttpResponse.json(null)));
});

describe("the period summary", () => {
  it("starts with leads and a placeholder to configure it", async () => {
    setup();

    await screen.findByRole("button", { name: "Настроить показатели" });
    expect(shownTiles()).toEqual(["conversions"]);
    expect(within(summary()).getByText("Лиды")).toBeInTheDocument();
    expect(within(summary()).queryByText("Расход")).not.toBeInTheDocument();
  });

  it("offers a thumbnail of every tile with the period's figures and marks the chosen ones", async () => {
    setup();
    const dialog = await openDialog();

    expect(within(dialog).getByText("1/5")).toBeInTheDocument();
    const thumbnails = within(dialog).getAllByRole("button", { pressed: false }).concat(within(dialog).getAllByRole("button", { pressed: true }));
    expect(thumbnails.map((thumbnail) => thumbnail.getAttribute("aria-label")).sort()).toEqual(["CPC", "Клики", "Лиды", "Показы", "Расход"].sort());
    expect(within(dialog).getByRole("button", { name: "Лиды" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Лиды" })).toHaveAttribute("data-selected", "true");
    expect(within(within(dialog).getByRole("button", { name: "Расход" })).getByText("1 500 ₽")).toBeInTheDocument();
  });

  it("adds a tile at once and shows chosen tiles in catalogue order", async () => {
    setup();
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("button", { name: "Расход" }));

    expect(within(dialog).getByText("2/5")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Расход" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(shownTiles()).toEqual(["spend", "conversions"]));
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
    setup({ screen: "project", kpi: { scope: { kind: "project", id: "p1" }, canEdit: false } });
    const dialog = await openDialog();

    for (const name of ["Расход", "Показы", "Клики", "CPC"]) await userEvent.click(within(dialog).getByRole("button", { name }));

    expect(within(dialog).getByText("5/5")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "KPI" })).toBeDisabled();
    expect(within(dialog).getByText("Можно выбрать не больше 5 показателей")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Клики" }));
    expect(within(dialog).getByRole("button", { name: "KPI" })).not.toBeDisabled();
  });

  it("remembers each screen separately and across reloads", async () => {
    const { unmount } = setup();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Расход" }));
    unmount();

    setup({ screen: "project", kpi: { scope: { kind: "project", id: "p1" }, canEdit: false } });
    await screen.findByRole("button", { name: "Настроить показатели" });
    expect(shownTiles()).toEqual(["conversions"]);
    expect(JSON.parse(localStorage.getItem("adpulse-summary-tiles")!).state.layouts["user-1"]).toEqual({ dashboard: ["spend", "conversions"] });
  });

  it("belongs to the person who chose it", async () => {
    useSummaryTiles.setState({ layouts: { "user-1": { dashboard: ["spend"] } } });
    signedInAs("user-2");
    setup();

    await screen.findByRole("button", { name: "Настроить показатели" });
    await waitFor(() => expect(shownTiles()).toEqual(["conversions"]));
  });

  it("offers KPI only where a KPI is bound and ignores a stored tile that is not offered", async () => {
    useSummaryTiles.setState({ layouts: { "user-1": { dashboard: ["spend", "kpi"] } } });
    setup();

    await waitFor(() => expect(shownTiles()).toEqual(["spend"]));
    const dialog = await openDialog();
    expect(within(dialog).queryByRole("button", { name: "KPI" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("1/5")).toBeInTheDocument();
  });

  it("offers KPI on a project page to a member who cannot change it", async () => {
    setup({ screen: "project", kpi: { scope: { kind: "project", id: "p1" }, canEdit: false } });

    const dialog = await openDialog();
    expect(within(dialog).getByRole("button", { name: "KPI" })).toHaveAttribute("aria-pressed", "false");
  });
});
