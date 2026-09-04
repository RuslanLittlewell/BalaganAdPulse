import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aClient, server } from "@test/shared/index.js";
import { renderWithProviders } from "@test/shared/index.js";
import { ClientFormDialog } from "@/features/client-management/ui/ClientFormDialog.js";

describe("ClientFormDialog", () => {
  it("creates a client, sending the trimmed name", async () => {
    let received: unknown;
    server.use(
      mock.post("/api/clients", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          aClient({ id: "9", name: "Acme" }),
          { status: 201 },
        );
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<ClientFormDialog onClose={onClose} />);

    await userEvent.type(screen.getByLabelText("Имя"), "  Acme  ");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(received).toEqual({ name: "Acme" });
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
    await userEvent.type(screen.getByLabelText("Имя"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));
    expect(await screen.findByText("name is required")).toBeInTheDocument();
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

    await userEvent.type(screen.getByLabelText("Имя"), "Acme");
    await userEvent.type(screen.getByLabelText("Email клиента"), "buyer@acme");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Введите корректный email")).toBeInTheDocument();
    expect(calls).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("prefills fields in edit mode and saves with PATCH", async () => {
    let method = "";
    server.use(
      mock.patch("/api/clients/1", async ({ request }) => {
        method = request.method;
        return HttpResponse.json(aClient({ name: "Renamed" }));
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(
      <ClientFormDialog
        onClose={onClose}
        client={aClient()}
      />,
    );
    expect(screen.getByLabelText("Имя")).toHaveValue("Acme");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(method).toBe("PATCH");
  });
});
