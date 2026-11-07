import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { CrmPage } from "@/pages/crm/index.js";

const capabilities = { create: true, update: true, delete: true };
const readOnly = { create: false, update: false, delete: false };

function boards(caps = capabilities) {
  server.use(
    mock.get("/api/crm/boards", () => HttpResponse.json([
      { key: "project-1", label: "Сайт", clientName: "Ромашка", capabilities: caps },
      { key: "project-2", label: "Реклама", clientName: "Ромашка", capabilities: caps },
    ])),
    mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    mock.get("/api/crm/boards/project-1/fields", () => HttpResponse.json([
      { id: "budget", name: "Бюджет", type: "NUMBER", options: [], position: 0 },
    ])),
  );
}

describe("Поля доски in the CRM settings", () => {
  it("opens the selected board's fields", async () => {
    boards();
    renderWithProviders(<CrmPage />, { route: "/crm?board=project-1" });

    await userEvent.click(await screen.findByRole("button", { name: "Настройки" }));
    await userEvent.click(await screen.findByRole("button", { name: "Поля доски" }));

    expect(await screen.findByRole("dialog", { name: "Поля доски" })).toBeInTheDocument();
    expect(await screen.findByText("Бюджет", { selector: "span" })).toBeInTheDocument();
  });

  it("is not offered to a member who may not create leads", async () => {
    boards(readOnly);
    renderWithProviders(<CrmPage />, { route: "/crm?board=project-1" });

    await userEvent.click(await screen.findByRole("button", { name: "Настройки" }));
    expect(await screen.findByRole("radiogroup", { name: "Раскладка" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Поля доски" })).not.toBeInTheDocument();
  });
});
