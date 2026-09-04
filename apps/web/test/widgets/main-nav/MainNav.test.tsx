import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { MainNav } from "@/widgets/main-nav/MainNav.js";

const MODULES = ["Дашборд", "Проекты", "Задачи", "Отчёты", "Архив"];

function setup(route = "/") {
  return renderWithProviders(
    <Routes>
      <Route path="*" element={<MainNav />} />
    </Routes>,
    { route },
  );
}

function asAdmin() {
  server.use(mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "u1", name: "Админ", email: "a@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role: "ADMIN",
    clientIds: [],
  })));
}

describe("MainNav", () => {
  it("offers no Team entry, even to an admin", async () => {
    asAdmin();
    setup();

    const nav = screen.getByRole("navigation", { name: "Разделы" });
    await waitFor(() =>
      expect(within(nav).getAllByRole("link")).toHaveLength(MODULES.length));
    expect(screen.queryByRole("link", { name: "Команда" })).not.toBeInTheDocument();
  });

  it("lists the five modules, in order", () => {
    setup();
    const nav = screen.getByRole("navigation", { name: "Разделы" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(MODULES);
  });

  it("marks the module the visitor is in", () => {
    setup("/projects/1/campaigns/2");
    expect(screen.getByRole("link", { name: "Проекты" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Задачи" })).not.toHaveAttribute("aria-current");
  });

  it("does not mark the dashboard on every route, though it sits at the root", () => {
    setup("/projects");
    expect(screen.getByRole("link", { name: "Дашборд" })).not.toHaveAttribute("aria-current");
  });

  it("marks the dashboard at the root", () => {
    setup("/");
    expect(screen.getByRole("link", { name: "Дашборд" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates to a module", async () => {
    setup();
    await userEvent.click(screen.getByRole("link", { name: "Отчёты" }));
    expect(screen.getByRole("link", { name: "Отчёты" })).toHaveAttribute("aria-current", "page");
  });

  it("no longer lists clients", () => {
    setup();
    expect(screen.queryByText("Клиенты")).not.toBeInTheDocument();
  });
});
