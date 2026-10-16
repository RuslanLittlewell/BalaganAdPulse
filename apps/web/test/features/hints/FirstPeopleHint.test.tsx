import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aClient, aSession, renderWithProviders, server } from "@test/shared/index.js";
import { useHintMemory } from "@/features/hints/index.js";
import { AppHeader } from "@/widgets/app-header/AppHeader.js";

const HINT = "Добавить клиентов и сотрудников";

const me = { id: "m-1", userId: "user-1", name: "Buyer", email: "buyer@acme.com", image: null, phone: null, telegram: null, role: "ADMIN", status: "ACTIVE", createdAt: "" };
const colleague = { ...me, id: "m-2", userId: "user-2", name: "Мария", email: "maria@acme.com", role: "MANAGER" };

function organization({ clients = [] as unknown[], staff = [me] as unknown[], session = aSession() } = {}) {
  server.use(
    http.get("/api/auth/me", () => HttpResponse.json(session)),
    http.get("/api/clients", () => HttpResponse.json(clients)),
    http.get("/api/members", () => HttpResponse.json(staff)),
  );
}

async function findHint() {
  return (await screen.findByText(HINT)).closest("[role='status']") as HTMLElement;
}

async function settled() {
  await screen.findByRole("button", { name: /Buyer/ });
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("the first-people hint", () => {
  it("points a fresh organization's admin to the contact book", async () => {
    organization();
    renderWithProviders(<AppHeader />);

    const hint = await findHint();
    expect(hint).toBeInTheDocument();
    expect(hint).toContainElement(screen.getByRole("button", { name: "Закрыть подсказку" }));
  });

  it("is not shown once there is a client", async () => {
    organization({ clients: [aClient()] });
    renderWithProviders(<AppHeader />);

    await settled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("is not shown once there is another employee", async () => {
    organization({ staff: [me, colleague] });
    renderWithProviders(<AppHeader />);

    await settled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("is not shown to a manager", async () => {
    organization({ session: aSession({ role: "MANAGER" }) });
    renderWithProviders(<AppHeader />);

    await settled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("stays on a click elsewhere and on Escape", async () => {
    organization();
    renderWithProviders(<AppHeader />);
    await screen.findByText(HINT);

    await userEvent.click(document.body);
    await userEvent.keyboard("{Escape}");

    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it("does not take the focus from the page", async () => {
    organization();
    renderWithProviders(<AppHeader />);
    const hint = await findHint();

    expect(hint).not.toContainElement(document.activeElement as HTMLElement);
  });

  it("goes away when closed, and stays closed for that person", async () => {
    organization();
    const { unmount } = renderWithProviders(<AppHeader />);
    await screen.findByText(HINT);

    await userEvent.click(screen.getByRole("button", { name: "Закрыть подсказку" }));

    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
    expect(useHintMemory.getState().dismissed).toEqual({ "user-1": ["contacts.firstPeople"] });
    unmount();

    renderWithProviders(<AppHeader />);
    await settled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("is still shown to another person after one closed it", async () => {
    useHintMemory.setState({ dismissed: { "someone-else": ["contacts.firstPeople"] } });
    organization();
    renderWithProviders(<AppHeader />);

    expect(await screen.findByText(HINT)).toBeInTheDocument();
  });

  it("hides while the contact book is open", async () => {
    server.use(http.get("/api/invites", () => HttpResponse.json([])));
    organization();
    renderWithProviders(<AppHeader />);
    await screen.findByText(HINT);

    await userEvent.click(screen.getByRole("button", { name: "Контактная книга" }));

    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.queryByText(HINT)).not.toBeInTheDocument());
  });
});
