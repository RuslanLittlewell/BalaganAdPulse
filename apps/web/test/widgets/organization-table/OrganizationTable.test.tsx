import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aPlatformOrganization, renderWithProviders, server } from "@test/shared/index.js";
import { OrganizationTable } from "@/widgets/organization-table/index.js";

const listed = (...organizations: ReturnType<typeof aPlatformOrganization>[]) =>
  server.use(mock.get("/api/platform/organizations", () => HttpResponse.json(organizations)));

const rowOf = async (name: string) =>
  (await screen.findByRole("rowheader", { name: new RegExp(name) })).closest("tr") as HTMLElement;

describe("the organization table", () => {
  it("lists each organization with its status, modules, members and creation date", async () => {
    listed(
      aPlatformOrganization(),
      aPlatformOrganization({
        id: "org-2", name: "Acme", slug: "acme", status: "SUSPENDED",
        modules: ["DASHBOARD", "PROJECTS", "CRM"], activeMembers: 0,
        createdAt: "2026-10-15T09:00:00.000Z",
      }),
    );
    renderWithProviders(<OrganizationTable />);

    const balagan = await rowOf("Balagan");
    expect(balagan).toHaveAttribute("data-status", "ACTIVE");
    expect(within(balagan).getByText("Активна")).toBeInTheDocument();
    expect(within(balagan).getByText("balagan")).toBeInTheDocument();
    expect(within(balagan).getByText("12")).toBeInTheDocument();
    expect(within(within(balagan).getByRole("list", { name: "Модули: Balagan" })).getAllByRole("listitem")
      .map((item) => item.textContent)).toEqual(["Дашборд", "Проекты", "CRM", "Задачи", "Отчёты"]);

    const acme = await rowOf("Acme");
    expect(acme).toHaveAttribute("data-status", "SUSPENDED");
    expect(within(acme).getByText("Приостановлена")).toBeInTheDocument();
    expect(within(acme).getByText("15.10.2026")).toBeInTheDocument();
    expect(within(within(acme).getByRole("list", { name: "Модули: Acme" })).getAllByRole("listitem")
      .map((item) => item.textContent)).toEqual(["Дашборд", "Проекты", "CRM"]);
  });

  it("offers the pending first administrator's link for copying", async () => {
    listed(aPlatformOrganization({
      firstAdmin: { email: "owner@acme.com", state: "PENDING", registrationUrl: "/registration/ABCDEFGH" },
    }));
    renderWithProviders(<OrganizationTable />);

    const row = await rowOf("Balagan");
    expect(within(row).getByText("owner@acme.com")).toBeInTheDocument();
    expect(within(row).getByText("Ожидает регистрации")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Скопировать ссылку регистрации" })).toBeInTheDocument();
  });

  it("shows a registered first administrator without a link", async () => {
    listed(aPlatformOrganization({
      firstAdmin: { email: "owner@acme.com", state: "ACCEPTED", registrationUrl: null },
    }));
    renderWithProviders(<OrganizationTable />);

    const row = await rowOf("Balagan");
    expect(within(row).getByText("Зарегистрирован")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Скопировать ссылку регистрации" })).not.toBeInTheDocument();
  });

  it("offers to suspend an active organization and to reactivate a suspended one", async () => {
    listed(
      aPlatformOrganization(),
      aPlatformOrganization({ id: "org-2", name: "Acme", slug: "acme", status: "SUSPENDED" }),
    );
    renderWithProviders(<OrganizationTable />);

    expect(await screen.findByRole("button", { name: "Приостановить: Balagan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Возобновить: Balagan" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Возобновить: Acme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Изменить: Acme" })).toBeInTheDocument();
  });

  it("says so when there are no organizations", async () => {
    listed();
    renderWithProviders(<OrganizationTable />);
    expect(await screen.findByText("Организаций пока нет")).toBeInTheDocument();
  });

  it("says so when the list cannot be loaded", async () => {
    server.use(mock.get("/api/platform/organizations", () => new HttpResponse(null, { status: 500 })));
    renderWithProviders(<OrganizationTable />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить организации");
  });

  describe("sorting", () => {
    const names = () => screen.getAllByRole("rowheader").map((header) => header.textContent ?? "");

    const populate = () => listed(
      aPlatformOrganization({ id: "o1", name: "Beta", slug: "beta", activeMembers: 3, createdAt: "2026-09-01T00:00:00.000Z", firstAdmin: { email: "z@beta.io", state: "ACCEPTED", registrationUrl: null } }),
      aPlatformOrganization({ id: "o2", name: "alpha", slug: "alpha", activeMembers: 20, status: "SUSPENDED", modules: ["DASHBOARD"], createdAt: "2026-10-01T00:00:00.000Z", firstAdmin: { email: "a@alpha.io", state: "ACCEPTED", registrationUrl: null } }),
      aPlatformOrganization({ id: "o3", name: "Gamma", slug: "gamma", activeMembers: 9, createdAt: "2026-08-01T00:00:00.000Z", firstAdmin: null }),
    );

    it("sorts a column descending, then ascending, then back to the listed order", async () => {
      populate();
      const user = userEvent.setup();
      renderWithProviders(<OrganizationTable />);
      await screen.findByRole("rowheader", { name: /Beta/ });
      const nameHeader = () => screen.getByRole("columnheader", { name: "Название" });
      expect(names()).toEqual(["Betabeta", "alphaalpha", "Gammagamma"]);

      await user.click(screen.getByRole("button", { name: "Название" }));
      expect(names()).toEqual(["Gammagamma", "Betabeta", "alphaalpha"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "descending");

      await user.click(screen.getByRole("button", { name: "Название" }));
      expect(names()).toEqual(["alphaalpha", "Betabeta", "Gammagamma"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "ascending");

      await user.click(screen.getByRole("button", { name: "Название" }));
      expect(names()).toEqual(["Betabeta", "alphaalpha", "Gammagamma"]);
      expect(nameHeader()).toHaveAttribute("aria-sort", "none");
    });

    it("sorts the member count by value and puts a missing administrator last either way", async () => {
      populate();
      const user = userEvent.setup();
      renderWithProviders(<OrganizationTable />);
      await screen.findByRole("rowheader", { name: /Beta/ });

      await user.click(screen.getByRole("button", { name: "Участники" }));
      expect(names().map((entry) => entry.slice(0, 4))).toEqual(["alph", "Gamm", "Beta"]);

      await user.click(screen.getByRole("button", { name: "Первый администратор" }));
      expect(names().at(-1)).toMatch(/^Gamma/);
      expect(screen.getByRole("columnheader", { name: "Участники" })).toHaveAttribute("aria-sort", "none");
      await user.click(screen.getByRole("button", { name: "Первый администратор" }));
      expect(names().at(-1)).toMatch(/^Gamma/);
    });

    it("sorts by creation date, newest first, and leaves the actions column unsortable", async () => {
      populate();
      const user = userEvent.setup();
      renderWithProviders(<OrganizationTable />);
      await screen.findByRole("rowheader", { name: /Beta/ });

      await user.click(screen.getByRole("button", { name: "Создана" }));
      expect(names().map((entry) => entry.slice(0, 4))).toEqual(["alph", "Beta", "Gamm"]);
      expect(screen.queryByRole("button", { name: "Действия" })).not.toBeInTheDocument();
    });
  });
});
