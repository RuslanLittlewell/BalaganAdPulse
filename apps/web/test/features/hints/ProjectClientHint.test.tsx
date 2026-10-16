import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Role } from "@adpulse/access-policy";
import { aClient, aSession, renderWithProviders, server } from "@test/shared/index.js";
import { useHintMemory } from "@/features/hints/index.js";
import { ProjectFormDialog } from "@/features/project-management/ui/ProjectFormDialog.js";

const HINT = "Добавьте клиента";

function openDialog({ clients = [] as unknown[], role = "ADMIN" as Role } = {}) {
  server.use(
    http.get("/api/auth/me", () => HttpResponse.json(aSession({ role }))),
    http.get("/api/clients", () => HttpResponse.json(clients)),
  );
  renderWithProviders(<ProjectFormDialog onClose={() => {}} />);
}

describe("the new-project dialog's add-client hint", () => {
  it("points at the add-client button while there are no clients", async () => {
    openDialog();

    const hint = (await screen.findByText(HINT)).closest("[role='status']") as HTMLElement;
    expect(within(hint).getByRole("button", { name: "Закрыть подсказку" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Новый клиент" })).toBeInTheDocument();
  });

  it("is not shown once there is a client", async () => {
    openDialog({ clients: [aClient()] });

    await screen.findByRole("button", { name: "Новый клиент" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("is not shown to someone who may not create clients", async () => {
    openDialog({ role: "CLIENT" });

    await screen.findByRole("dialog");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("hides while the client form is open", async () => {
    openDialog();
    await screen.findByText(HINT);

    await userEvent.click(screen.getByRole("button", { name: "Новый клиент" }));

    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
  });

  it("stays closed on its own once closed, keeping the dialog open", async () => {
    openDialog();
    await screen.findByText(HINT);

    await userEvent.click(screen.getByRole("button", { name: "Закрыть подсказку" }));

    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useHintMemory.getState().dismissed).toEqual({ "user-1": ["projects.firstClient"] });
  });
});
