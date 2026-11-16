import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { CrmLayout, CrmPage } from "@/pages/crm/index.js";
import { AppHeader } from "@/widgets/app-header/index.js";

const capabilities = { create: true, update: true, delete: true };

const serve = (role: string) => server.use(
  mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    clientIds: role === "CLIENT" ? ["client-1"] : [],
  })),
  mock.get("/api/crm/boards", () => HttpResponse.json([{ key: "project-1", label: "Сайт", clientId: "client-1", clientName: "Ромашка", capabilities }])),
  mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json([])),
  mock.get("/api/projects/project-1/website-key", () => HttpResponse.json(null)),
);

const setup = (route = "/crm") => renderWithProviders(
  <>
    <AppHeader />
    <Routes>
      <Route path="/crm" element={<CrmLayout />}><Route index element={<CrmPage />} /></Route>
      <Route path="/tasks" element={<p>Задачи</p>} />
    </Routes>
  </>,
  { route },
);

describe("the website leads button in the application header", () => {
  it("opens the key dialog of the board's project for a manager", async () => {
    serve("MANAGER");
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Web интеграция" }));

    expect(await screen.findByRole("button", { name: "Создать ключ" })).toBeInTheDocument();
  });

  it("is offered only in the CRM", async () => {
    serve("MANAGER");
    setup("/tasks");

    await screen.findByText("Задачи");
    expect(screen.queryByRole("button", { name: "Web интеграция" })).not.toBeInTheDocument();
  });

  it("is not offered to a customer", async () => {
    serve("CLIENT");
    setup();

    await screen.findByRole("heading", { name: "Лиды" });
    expect(screen.queryByRole("button", { name: "Web интеграция" })).not.toBeInTheDocument();
  });
});
