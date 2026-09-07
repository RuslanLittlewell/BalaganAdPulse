import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { realtime, renderWithProviders, server } from "@test/shared/index.js";
import { AppHeader } from "@/widgets/app-header/AppHeader.js";

describe("AppHeader", () => {
  it("shows who is online between the action buttons and the account", async () => {
    server.use(realtime.addEventListener("connection", ({ client }) => {
      client.send(JSON.stringify({
        kind: "presence.state",
        people: [{
          userId: "u2", membershipId: "m2", name: "Мария", image: "2026-09-01T00:00:00.000Z",
        }],
      }));
    }));
    renderWithProviders(<AppHeader />);

    const roster = await screen.findByTestId("online-users");
    const activity = await screen.findByRole("button", { name: "История действий" });
    const account = await screen.findByRole("button", { name: /Buyer/ });

    expect(activity.compareDocumentPosition(roster) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(roster.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(roster).getByRole("img", { name: "Мария" })).toBeInTheDocument();
  });

  it("renders the account and theme controls", async () => {
    renderWithProviders(<AppHeader />);
    expect(await screen.findByRole("button", { name: /Buyer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /тему/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Контактная книга" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "История действий" })).toBeInTheDocument();
  });

  it("opens the activity log from the header", async () => {
    server.use(http.get("/api/audit", () => HttpResponse.json({ items: [], nextCursor: null })));
    renderWithProviders(<AppHeader />);
    await userEvent.click(await screen.findByRole("button", { name: "История действий" }));
    expect(await screen.findByRole("dialog", { name: "История действий" })).toBeInTheDocument();
  });

  it("opens the contact book from the header", async () => {
    renderWithProviders(<AppHeader />);
    await userEvent.click(screen.getByRole("button", { name: "Контактная книга" }));
    expect(await screen.findByRole("dialog", { name: "Контактная книга" })).toBeInTheDocument();
  });

  it("opens profile settings from the account menu", async () => {
    renderWithProviders(<AppHeader />);
    await userEvent.click(await screen.findByRole("button", { name: /Buyer/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Настройки" }));
    expect(screen.getByRole("dialog", { name: "Настройки профиля" })).toBeInTheDocument();
    expect(screen.getByLabelText("Имя")).toHaveValue("Buyer");
    expect(screen.getByRole("button", { name: "Изменить аватар" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Изменить аватар" }));
    expect(screen.getByRole("dialog", { name: "Редактор аватара" })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(13);
  });
});
