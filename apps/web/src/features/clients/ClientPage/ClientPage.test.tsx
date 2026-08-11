import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { server } from "../../../test/server.js";
import { renderWithProviders } from "../../../test/utils.js";
import { ClientPage } from "./ClientPage.js";
import { EmptyState } from "../../../components/EmptyState/EmptyState.js";

const client = { id: "1", name: "Acme", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" };

function setup(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<EmptyState title="root" />} />
      <Route path="/clients/:clientId" element={<ClientPage />} />
      <Route path="/clients/:clientId/campaigns/:campaignId" element={<ClientPage />} />
    </Routes>,
    { route },
  );
}

describe("ClientPage", () => {
  it("shows the selected client's header", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([client])));
    setup("/clients/1");
    expect(await screen.findByRole("heading", { name: "Acme" })).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown id", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([client])));
    setup("/clients/999");
    expect(await screen.findByText("Client not found")).toBeInTheDocument();
  });

  it("deletes after confirmation and navigates home", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.delete("/api/clients/1", () => new HttpResponse(null, { status: 204 })),
    );
    setup("/clients/1");
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    // the confirm dialog adds a second "Delete" button; click the last-rendered one
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await waitFor(() => expect(screen.getByText("root")).toBeInTheDocument());
  });

  it("redirects to the first campaign when the URL has none", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () =>
        HttpResponse.json([
          { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
        ]),
      ),
      mock.get("/api/campaigns/c1", () =>
        HttpResponse.json({
          id: "c1", clientId: "1", name: "Search ads", position: 0,
          properties: [], records: [], totals: {},
        }),
      ),
    );

    setup("/clients/1");

    expect(await screen.findByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows an empty state when the client has no campaigns", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () => HttpResponse.json([])),
    );

    setup("/clients/1");

    expect(await screen.findByText("No sheets yet")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows an error state with retry when campaigns fail to load", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () => new HttpResponse(null, { status: 500 })),
    );

    setup("/clients/1");

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("creates a sheet from the empty state and opens it", async () => {
    const created = {
      id: "c9", clientId: "1", name: "Main", position: 0, createdAt: "", updatedAt: "",
    };
    let listed: unknown[] = [];
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () => HttpResponse.json(listed)),
      mock.post("/api/clients/1/campaigns", () => {
        listed = [created];
        return HttpResponse.json(created, { status: 201 });
      }),
      mock.get("/api/campaigns/c9", () =>
        HttpResponse.json({ ...created, properties: [], records: [], totals: {} }),
      ),
    );

    setup("/clients/1");

    await userEvent.click(await screen.findByRole("button", { name: "Create a sheet" }));
    await userEvent.type(screen.getByLabelText("Name"), "Main");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("tab", { name: "Main" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the rename dialog prefilled from the pencil, and saving renames the tab", async () => {
    let listed: unknown[] = [
      { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
    ];
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () => HttpResponse.json(listed)),
      mock.get("/api/campaigns/c1", () =>
        HttpResponse.json({
          id: "c1", clientId: "1", name: "Search ads", position: 0,
          properties: [], records: [], totals: {},
        }),
      ),
      mock.patch("/api/campaigns/c1", () => {
        const renamed = { id: "c1", clientId: "1", name: "Renamed", position: 0, createdAt: "", updatedAt: "" };
        listed = [renamed];
        return HttpResponse.json(renamed);
      }),
    );

    setup("/clients/1");

    await userEvent.click(await screen.findByRole("button", { name: "Rename sheet" }));

    const nameField = screen.getByLabelText("Name");
    expect(nameField).toHaveValue("Search ads");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    await userEvent.clear(nameField);
    await userEvent.type(nameField, "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("tab", { name: "Renamed" })).toBeInTheDocument();
  });

  it("confirms a sheet deletion and opens the neighbouring sheet", async () => {
    let listed = [
      { id: "c1", clientId: "1", name: "Search ads", position: 0, createdAt: "", updatedAt: "" },
      { id: "c2", clientId: "1", name: "Display", position: 1, createdAt: "", updatedAt: "" },
    ];
    const table = (id: string, name: string) => ({
      id, clientId: "1", name, position: 0, properties: [], records: [], totals: {},
    });
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([client])),
      mock.get("/api/clients/1/campaigns", () => HttpResponse.json(listed)),
      mock.get("/api/campaigns/c1", () => HttpResponse.json(table("c1", "Search ads"))),
      mock.get("/api/campaigns/c2", () => HttpResponse.json(table("c2", "Display"))),
      mock.delete("/api/campaigns/c2", () => {
        listed = [listed[0]];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    setup("/clients/1/campaigns/c2");

    await userEvent.click(await screen.findByRole("button", { name: "Delete sheet" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("tab", { name: "Search ads" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Display" })).not.toBeInTheDocument();
  });
});
