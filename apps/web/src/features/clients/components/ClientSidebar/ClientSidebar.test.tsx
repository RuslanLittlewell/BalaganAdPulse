import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { server } from "../../../../test/server.js";
import { renderWithProviders } from "../../../../test/utils.js";
import { ClientSidebar } from "./ClientSidebar.js";

function setup(route = "/") {
  return renderWithProviders(
    <Routes>
      <Route path="*" element={<ClientSidebar />} />
    </Routes>,
    { route },
  );
}

describe("ClientSidebar", () => {
  it("renders clients from the API", async () => {
    server.use(
      mock.get("/api/clients", () =>
        HttpResponse.json([
          { id: "1", name: "Acme", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" },
        ]),
      ),
    );
    setup();
    expect(await screen.findByText("Acme")).toBeInTheDocument();
  });

  it("shows an empty state when there are no clients", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([])));
    setup();
    expect(await screen.findByRole("button", { name: /New client/ })).toBeInTheDocument();
  });

  it("shows an error state with a retry button on failure", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json({ error: { message: "boom" } }, { status: 500 })));
    setup();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("opens the new-client dialog", async () => {
    server.use(mock.get("/api/clients", () => HttpResponse.json([])));
    setup();
    await userEvent.click(await screen.findByRole("button", { name: /New client/ }));
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeInTheDocument());
  });
});
