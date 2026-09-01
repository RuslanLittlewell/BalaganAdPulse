import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, renderWithProviders } from "@test/shared/index.js";
import { ContactBook } from "@/widgets/contact-book/index.js";
import { ProjectList } from "@/widgets/project-list/index.js";
import { CampaignSheet } from "@/widgets/campaign-sheet/index.js";
import { CampaignTabs } from "@/features/campaign-management/index.js";

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

  it("hides campaign, row and value editing controls", async () => {
    guestSession();
    server.use(http.get("/api/campaigns/c1", () => HttpResponse.json({
      id: "c1", name: "Search", position: 0,
      properties: [{ id: "p1", key: "spend", name: "SPEND", type: "MONEY", position: 0, formula: null }],
      records: [{ id: "r1", date: "2026-08-01", values: { p1: "10.0000" } }],
      totals: { p1: "10.0000" },
    })));

    const tabs = renderWithProviders(
      <CampaignTabs projectId="project-1" campaigns={[{
        id: "c1", projectId: "project-1", name: "Search", position: 0, createdAt: "", updatedAt: "",
      }]}
        activeCampaignId="c1" onNew={() => {}} onRename={() => {}} />,
    );
    expect(await screen.findByText("Search")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: /новый/i })).not.toBeInTheDocument());
    expect(screen.queryByLabelText("Переименовать лист")).not.toBeInTheDocument();
    tabs.unmount();

    renderWithProviders(<CampaignSheet campaignId="c1" />);
    expect(await screen.findAllByRole("cell", { name: "10.00" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "+ Добавить день" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Удалить день/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "SPEND, 01 авг." })).not.toBeInTheDocument();
  });
});
