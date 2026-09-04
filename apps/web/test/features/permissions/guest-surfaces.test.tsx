import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, renderWithProviders } from "@test/shared/index.js";
import { ContactBook } from "@/widgets/contact-book/index.js";
import { ProjectList } from "@/widgets/project-list/index.js";
import { ProjectPage } from "@/pages/project/index.js";

function guestSession() {
  server.use(http.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "guest-1", name: "Guest", email: "guest@example.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role: "GUEST",
    clientIds: ["client-1"],
  })));
}

describe("guest controls", () => {
  it("hides client and project creation and editing", async () => {
    guestSession();
    server.use(http.get("/api/clients", () => HttpResponse.json([{
      id: "client-1", name: "Acme", fullName: null, organization: null, unp: null,
      phone: null, telegram: null, email: null, website: null, image: null, avatarPath: null,
      createdAt: "", updatedAt: "",
    }])));

    const contact = renderWithProviders(<ContactBook open onClose={() => {}} />);
    expect(await screen.findAllByText("Acme")).not.toHaveLength(0);
    expect(screen.queryByLabelText("Новый контакт")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Редактировать контакт")).not.toBeInTheDocument();
    contact.unmount();

    renderWithProviders(<ProjectList />);
    expect(await screen.findByText("Проектов пока нет")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Новый проект" })).not.toBeInTheDocument();
  });

  // Figures are measurements, not entries: there is nothing to edit at any
  // role. What matters for a guest is that they can read what they are granted.
  it("reads a project's figures without any control that writes", async () => {
    guestSession();
    const performance = {
      spend: 4200, impressions: 100000, reach: 40000, clicks: 2000, conversions: 50,
      revenue: 4000, ctr: 2, cpc: 0.5, cpm: 10, cpa: 20, roas: 4, frequency: 2.5,
    };
    server.use(
      http.get("/api/clients", () => HttpResponse.json([])),
      http.get("/api/projects", () => HttpResponse.json([{
        id: "p1", clientId: "client-1", name: "Клиника", niche: null, monthlyBudget: null, budgetCurrency: "BYN",
        priority: "NEW", image: null, avatarPath: null, position: 0, createdAt: "", updatedAt: "",
      }])),
      http.get("/api/projects/:projectId/summary", () => HttpResponse.json(performance)),
      http.get("/api/projects/:projectId/campaigns", () => HttpResponse.json([{
        id: "c1", projectId: "p1", name: "Поиск", channel: "YANDEX", status: "ACTIVE",
        objective: null, externalId: null, position: 0, performance,
      }])),
    );

    renderWithProviders(<ProjectPage />, { route: "/projects/p1" });

    expect(await screen.findByRole("row", { name: /Поиск/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Редактировать" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });
});
