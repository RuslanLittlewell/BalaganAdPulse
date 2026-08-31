import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@test/shared/index.js";
import { AppHeader } from "@/widgets/app-header/AppHeader.js";

describe("AppHeader", () => {
  it("renders the account and theme controls", () => {
    renderWithProviders(<AppHeader />);
    expect(screen.getByRole("button", { name: /Buyer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /тему/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Контактная книга" })).toBeInTheDocument();
  });

  it("opens the contact book from the header", async () => {
    renderWithProviders(<AppHeader />);
    await userEvent.click(screen.getByRole("button", { name: "Контактная книга" }));
    expect(await screen.findByRole("dialog", { name: "Контактная книга" })).toBeInTheDocument();
  });

  it("opens profile settings from the account menu", async () => {
    renderWithProviders(<AppHeader />);
    await userEvent.click(screen.getByRole("button", { name: /Buyer/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Настройки" }));
    expect(screen.getByRole("dialog", { name: "Настройки профиля" })).toBeInTheDocument();
    expect(screen.getByLabelText("Имя")).toHaveValue("Buyer");
    expect(screen.getByRole("button", { name: "Изменить аватар" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Изменить аватар" }));
    expect(screen.getByRole("dialog", { name: "Редактор аватара" })).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(13);
  });
});
