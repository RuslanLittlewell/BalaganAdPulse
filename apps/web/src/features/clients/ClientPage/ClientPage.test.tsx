import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
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
});
