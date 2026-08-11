import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../../../../test/server.js";
import { renderWithProviders } from "../../../../test/utils.js";
import { CampaignSheet } from "./CampaignSheet.js";

const table = {
  id: "c1",
  clientId: "1",
  name: "Search ads",
  position: 0,
  properties: [
    { id: "p1", key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null },
    { id: "p2", key: "ctr", name: "CTR", type: "PERCENT", position: 1, formula: null },
    { id: "p3", key: "comment", name: "COMMENT", type: "TEXT", position: 2, formula: null },
  ],
  records: [
    { id: "r1", date: "2026-08-01", values: { p1: "120.0000", p2: "2.0000", p3: "good day" } },
    { id: "r2", date: "2026-08-02", values: { p1: "135.5000", p2: "1.9900", p3: null } },
  ],
  totals: { p1: "255.5000", p2: "2.2500", p3: null },
};

describe("CampaignSheet", () => {
  it("renders a column per property, a row per record and the totals row", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findByRole("columnheader", { name: "SPEND" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "DATE" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "COMMENT" })).toBeInTheDocument();

    expect(screen.getByRole("rowheader", { name: "01 Aug" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "120.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2.00%" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "good day" })).toBeInTheDocument();

    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).getByRole("rowheader")).toHaveTextContent("TOTAL");
    expect(within(footer).getByRole("cell", { name: "255.50" })).toBeInTheDocument();
    expect(within(footer).getByRole("cell", { name: "2.25%" })).toBeInTheDocument();
  });

  it("renders a dash for an empty cell", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findAllByRole("cell", { name: "—" })).toHaveLength(2);
  });

  it("renders the columns and the header even when the sheet has no days", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json({ ...table, records: [] })));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findByRole("columnheader", { name: "SPEND" })).toBeInTheDocument();
    expect(screen.getByText("Daily statistics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add day" })).toBeInTheDocument();
    // Header row and the TOTAL row, and no day rows between them.
    const body = screen.getAllByRole("rowgroup")[1];
    expect(within(body).queryAllByRole("row")).toHaveLength(0);
  });

  it("adds the day after the last row", async () => {
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.post("/api/campaigns/c1/records", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: "r9", campaignId: "c1", date: "2026-08-03" }, { status: 201 });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add day" }));

    // The fixture's last record is 2026-08-02.
    await waitFor(() => expect(received).toEqual({ date: "2026-08-03" }));
  });

  it("adds today when the sheet has no days", async () => {
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json({ ...table, records: [] })),
      mock.post("/api/campaigns/c1/records", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: "r9", campaignId: "c1", date: "2026-01-01" }, { status: 201 });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add day" }));

    const now = new Date();
    const today = [
      now.getFullYear(),
      `${now.getMonth() + 1}`.padStart(2, "0"),
      `${now.getDate()}`.padStart(2, "0"),
    ].join("-");
    await waitFor(() => expect(received).toEqual({ date: today }));
  });

  it("shows an error state with a retry button when the request fails", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json({}, { status: 500 })));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
