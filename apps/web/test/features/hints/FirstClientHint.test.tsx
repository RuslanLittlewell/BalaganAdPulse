import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Role } from "@adpulse/access-policy";
import { aClient, aSession, renderWithProviders, server } from "@test/shared/index.js";
import { useHintMemory } from "@/features/hints/index.js";
import { ContactBook } from "@/widgets/contact-book/index.js";

const HINT = "Создайте клиента";

async function openBook({ clients = [] as unknown[], role = "ADMIN" as Role } = {}) {
  server.use(
    http.get("/api/auth/me", () => HttpResponse.json(aSession({ role }))),
    http.get("/api/clients", () => HttpResponse.json(clients)),
  );
  renderWithProviders(<ContactBook open onClose={() => {}} />);
  return screen.findByRole("dialog", { name: "Контактная книга" });
}

async function settled() {
  await screen.findByRole("radio", { name: "Клиенты" });
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("the add-client hint", () => {
  it.each(["ADMIN", "MANAGER"] as const)("points %s at the add button of an empty list", async (role) => {
    await openBook({ role });

    const hint = (await screen.findByText(HINT)).closest("[role='status']") as HTMLElement;
    expect(hint).toContainElement(within(hint).getByRole("button", { name: "Закрыть подсказку" }));
    expect(screen.getByRole("button", { name: "Новый контакт" })).toBeInTheDocument();
  });

  it("says there are no clients in the details column", async () => {
    await openBook();

    expect(within(await screen.findByTestId("contact-book-details")).getByText("Клиентов пока нет"))
      .toBeInTheDocument();
  });

  it("is not shown once there is a client", async () => {
    await openBook({ clients: [aClient()] });

    await settled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("is not shown to someone who may not create clients", async () => {
    await openBook({ role: "GUEST" });

    await settled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("hides while a client is being created", async () => {
    await openBook();
    await screen.findByText(HINT);

    await userEvent.click(screen.getByRole("button", { name: "Новый контакт" }));

    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
  });

  it("can be closed while the contact book is open, and stays closed apart from the header hint", async () => {
    await openBook();
    await screen.findByText(HINT);

    await userEvent.click(screen.getByRole("button", { name: "Закрыть подсказку" }));

    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Контактная книга" })).toBeInTheDocument();
    expect(useHintMemory.getState().dismissed).toEqual({ "user-1": ["contacts.firstClient"] });
  });
});
