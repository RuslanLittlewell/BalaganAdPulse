import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../../../../test/server.js";
import { renderWithProviders } from "../../../../test/utils.js";
import { ClientFormDialog } from "./ClientFormDialog.js";

describe("ClientFormDialog", () => {
  it("creates a client, sending trimmed name and numeric budget", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { id: "9", name: "Acme", niche: null, monthlyBudget: "1000", email: null, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<ClientFormDialog onClose={onClose} />);

    await userEvent.type(screen.getByLabelText("Name"), "  Acme  ");
    await userEvent.type(screen.getByLabelText("Budget $/mo"), "1000");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(received).toEqual({ name: "Acme", monthlyBudget: 1000 });
  });

  it("shows field errors from a 400 response", async () => {
    server.use(
      mock.post("/api/clients", () =>
        HttpResponse.json(
          { error: { message: "Validation error", details: [{ path: ["name"], message: "name is required" }] } },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<ClientFormDialog onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("name is required")).toBeInTheDocument();
  });

  it("ignores keystrokes that would make the budget a non-number", async () => {
    renderWithProviders(<ClientFormDialog onClose={() => {}} />);
    const budget = screen.getByLabelText("Budget $/mo");

    await userEvent.type(budget, "12a.5b");

    expect(budget).toHaveValue("12.5");
  });

  it("rejects an invalid email inline without calling the API", async () => {
    let calls = 0;
    server.use(
      mock.post("/api/clients", () => {
        calls += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<ClientFormDialog onClose={onClose} />);

    await userEvent.type(screen.getByLabelText("Name"), "Acme");
    await userEvent.type(screen.getByLabelText("Client email"), "buyer@acme");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(calls).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("prefills fields in edit mode and saves with PATCH", async () => {
    let method = "";
    server.use(
      mock.patch("/api/clients/1", async ({ request }) => {
        method = request.method;
        return HttpResponse.json(
          { id: "1", name: "Renamed", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" },
        );
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(
      <ClientFormDialog
        onClose={onClose}
        client={{ id: "1", name: "Acme", niche: null, monthlyBudget: null, email: null, createdAt: "", updatedAt: "" }}
      />,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Acme");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(method).toBe("PATCH");
  });
});
