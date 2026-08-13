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
    { id: "p2", key: "ctr", name: "CTR", type: "PERCENT", position: 1,
      formula: { kind: "const", value: "2" } },
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

  it("opens an entered cell and leaves a computed one alone", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    expect(screen.getByRole("textbox", { name: "SPEND, 01 Aug" })).toHaveValue("120");

    // CTR is computed: its cell is plain text, with nothing to press.
    expect(screen.queryByRole("button", { name: "2.00%" })).not.toBeInTheDocument();
  });

  it("saves a cell and repaints the row and the totals from the answer", async () => {
    let gets = 0;
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => {
        gets += 1;
        return HttpResponse.json(table);
      }),
      mock.put("/api/records/r1/values/p1", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          record: { id: "r1", date: "2026-08-01", values: { p1: "200.0000", p2: "3.0000", p3: "good day" } },
          totals: { p1: "335.5000", p2: "2.5000", p3: null },
        });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    expect(await screen.findByRole("button", { name: "200.00" })).toBeInTheDocument();
    // The computed column and the footer follow from the same answer.
    expect(screen.getByRole("cell", { name: "3.00%" })).toBeInTheDocument();
    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).getByRole("cell", { name: "335.50" })).toBeInTheDocument();

    expect(received).toEqual({ value: "200" });
    // The proof that the cache was patched rather than refetched.
    expect(gets).toBe(1);
  });

  it("clears a cell when the input is emptied", async () => {
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          record: { id: "r1", date: "2026-08-01", values: { p1: null, p2: "2.0000", p3: "good day" } },
          totals: { p1: "135.5000", p2: "2.2500", p3: null },
        });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "SPEND, 01 Aug" }));
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(received).toEqual({ value: null }));
  });

  it("rejects input a numeric column cannot store without calling the API", async () => {
    let puts = 0;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", () => {
        puts += 1;
        return HttpResponse.json({ record: table.records[0], totals: table.totals });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    await userEvent.keyboard("abc{Enter}");

    const cell = await screen.findByRole("button", { name: "120.00" });
    await waitFor(() => expect(cell).toHaveAttribute("data-state", "error"));
    expect(cell).toHaveAttribute("title", "Enter a number");
    expect(puts).toBe(0);
  });

  it("shows the server's message when a write is refused", async () => {
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.put("/api/records/r1/values/p1", () =>
        HttpResponse.json({ error: { message: "Cannot write to a computed property" } }, { status: 400 }),
      ),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "120.00" }));
    await userEvent.keyboard("200{Enter}");

    const cell = await screen.findByRole("button", { name: "120.00" });
    await waitFor(() =>
      expect(cell).toHaveAttribute("title", "Cannot write to a computed property"),
    );
  });

  it("tabs from the last entered column of a row into the next row", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    // SPEND and COMMENT are entered; CTR is computed and is stepped over.
    await userEvent.click(await screen.findByRole("button", { name: "good day" }));
    await userEvent.keyboard("{Tab}");

    expect(screen.getByRole("textbox", { name: "SPEND, 02 Aug" })).toBeInTheDocument();
  });

  it("opens a date picker on the day cell and moves the day", async () => {
    let received: unknown;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.patch("/api/records/r1", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: "r1", campaignId: "c1", date: "2026-08-05" });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "01 Aug" }));
    await userEvent.click(screen.getByRole("button", { name: "05 August 2026" }));

    await waitFor(() => expect(received).toEqual({ date: "2026-08-05" }));
  });

  it("closes the picker on a click outside it", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "01 Aug" }));
    expect(screen.getByRole("dialog", { name: "Choose a date" })).toBeInTheDocument();

    await userEvent.click(document.body);

    expect(screen.queryByRole("dialog", { name: "Choose a date" })).not.toBeInTheDocument();
  });

  it("sends nothing when the same day is picked again", async () => {
    let patches = 0;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.patch("/api/records/r1", () => {
        patches += 1;
        return HttpResponse.json({ id: "r1", campaignId: "c1", date: "2026-08-01" });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "01 Aug" }));
    await userEvent.click(screen.getByRole("button", { name: "01 August 2026" }));

    expect(screen.queryByRole("dialog", { name: "Choose a date" })).not.toBeInTheDocument();
    expect(patches).toBe(0);
  });

  it("shows the server's message when the date is taken", async () => {
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.patch("/api/records/r1", () =>
        HttpResponse.json(
          { error: { message: "The campaign already has a record for 2026-08-02" } },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "01 Aug" }));
    await userEvent.click(screen.getByRole("button", { name: "02 August 2026" }));

    const trigger = await screen.findByRole("button", { name: "01 Aug" });
    await waitFor(() =>
      expect(trigger).toHaveAttribute("title", "The campaign already has a record for 2026-08-02"),
    );
    expect(trigger).toHaveAttribute("data-state", "error");
  });

  it("asks before deleting a day and then deletes it", async () => {
    let method = "";
    let gets = 0;
    server.use(
      mock.get("/api/campaigns/c1", () => {
        gets += 1;
        return HttpResponse.json(gets === 1 ? table : { ...table, records: [table.records[1]] });
      }),
      mock.delete("/api/records/r1", ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete day, 01 Aug" }));
    expect(screen.getByText("Delete day?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(method).toBe("DELETE");
    await waitFor(() =>
      expect(screen.queryByRole("rowheader", { name: "01 Aug" })).not.toBeInTheDocument(),
    );
  });

  it("keeps the day when the confirmation is cancelled", async () => {
    let deletes = 0;
    server.use(
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table)),
      mock.delete("/api/records/r1", () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Delete day, 01 Aug" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deletes).toBe(0);
    expect(screen.getByRole("rowheader", { name: "01 Aug" })).toBeInTheDocument();
  });

  it("renders no delete control on the totals row", async () => {
    server.use(mock.get("/api/campaigns/c1", () => HttpResponse.json(table)));

    renderWithProviders(<CampaignSheet campaignId="c1" />);

    await screen.findByRole("columnheader", { name: "SPEND" });
    const footer = screen.getAllByRole("rowgroup").at(-1)!;
    expect(within(footer).queryByRole("button")).not.toBeInTheDocument();
  });
});
