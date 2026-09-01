import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server } from "@test/shared/index.js";
import { AppHeader } from "@/widgets/app-header/AppHeader.js";

describe("AppHeader", () => {
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
