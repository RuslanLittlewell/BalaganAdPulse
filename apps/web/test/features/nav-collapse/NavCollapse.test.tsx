import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@test/shared/index.js";
import { AppHeader } from "@/widgets/app-header/AppHeader.js";
import { MainNav } from "@/widgets/main-nav/MainNav.js";

function setup() {
  return renderWithProviders(
    <Routes>
      <Route
        path="*"
        element={
          <>
            <AppHeader />
            <MainNav />
          </>
        }
      />
    </Routes>,
  );
}

const chevron = () =>
  screen.queryByRole("button", { name: "Свернуть меню" }) ??
  screen.getByRole("button", { name: "Развернуть меню" });

describe("collapsing the navigation", () => {
  beforeEach(() => localStorage.removeItem("adpulse.nav.collapsed"));

  it("starts expanded, with the labels showing", () => {
    setup();
    expect(screen.getByRole("button", { name: "Свернуть меню" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Проекты")).not.toHaveClass("sr-only");
  });

  it("collapses on the chevron and offers to expand again", async () => {
    setup();
    await userEvent.click(chevron());

    expect(screen.getByRole("button", { name: "Развернуть меню" }))
      .toHaveAttribute("aria-expanded", "false");
  });

  it("keeps every module reachable by name while collapsed", async () => {
    setup();
    await userEvent.click(chevron());

    for (const label of ["Дашборд", "Проекты", "Задачи", "Отчёты", "Архив"]) {
      expect(screen.getByRole("link", { name: label }), label).toBeInTheDocument();
    }
  });

  it("hides the labels visually, not from assistive tech", async () => {
    setup();
    await userEvent.click(chevron());

    expect(screen.getByText("Проекты")).toHaveClass("sr-only");
  });

  it("drops the section heading while collapsed, since it labels nothing visible", async () => {
    setup();
    expect(screen.getByText("Разделы")).toBeInTheDocument();
    await userEvent.click(chevron());
    expect(screen.queryByText("Разделы")).not.toBeInTheDocument();
  });

  it("expands again on a second click", async () => {
    setup();
    await userEvent.click(chevron());
    await userEvent.click(chevron());

    expect(screen.getByText("Проекты")).not.toHaveClass("sr-only");
  });

  it("remembers the choice across a reload", async () => {
    setup();
    await userEvent.click(chevron());

    expect(localStorage.getItem("adpulse.nav.collapsed")).toBe("true");
  });

  it("opens collapsed when that is what was remembered", () => {
    localStorage.setItem("adpulse.nav.collapsed", "true");
    setup();

    expect(screen.getByRole("button", { name: "Развернуть меню" })).toBeInTheDocument();
    expect(screen.getByText("Проекты")).toHaveClass("sr-only");
  });

  it("names a collapsed icon on hover, since its label is off-screen", async () => {
    setup();
    await userEvent.click(chevron());

    await userEvent.hover(screen.getByRole("link", { name: "Отчёты" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Отчёты");
  });

  it("shows no tooltip while expanded: the label is already on screen", async () => {
    setup();

    await userEvent.hover(screen.getByRole("link", { name: "Отчёты" }));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("centres each icon in the column once collapsed", async () => {
    setup();
    await userEvent.click(chevron());

    const link = screen.getByRole("link", { name: "Проекты" });
    expect(link).toHaveClass("size-10");
    expect(link).toHaveClass("justify-center");
  });

  it("stops centring when the labels come back", async () => {
    setup();
    expect(screen.getByRole("link", { name: "Проекты" })).not.toHaveClass("justify-center");
  });
});
