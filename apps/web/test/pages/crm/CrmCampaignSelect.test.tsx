import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { freezeDate, renderWithProviders, server } from "@test/shared/index.js";
import { CrmLayout, CrmPage } from "@/pages/crm/index.js";
import { saveCampaignCrm } from "@/features/profile-settings/model/preferences.js";
freezeDate("2026-09-15T12:00:00");

const capabilities = { create: true, update: true, delete: true };

const aLead = (fields: Record<string, unknown>) => ({
  id: "lead-1", orgId: "org-1", projectId: "project-1", project: { id: "project-1", clientId: "client-1", name: "Сайт" }, tags: [], name: "Анна", companyId: null, personId: null, company: null, person: null,
  source: null, notes: null, campaignId: null,
  stage: "NEW", position: 0, createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z", ...fields,
});

const serve = () => server.use(
  mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role: "ADMIN",
    clientIds: [],
  })),
  mock.get("/api/crm/boards", () => HttpResponse.json([{ key: "project-1", label: "Сайт", clientId: "client-1", clientName: "Ромашка", capabilities }])),
  mock.get("/api/projects/project-1/campaigns/names", () => HttpResponse.json([
    { id: "campaign-1", name: "Весенняя", channel: "META", status: "ACTIVE" },
    { id: "campaign-2", name: "Летняя", channel: "META", status: "ACTIVE" },
    { id: "campaign-3", name: "Старая", channel: "META", status: "PAUSED" },
  ])),
  mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json([
    aLead({ id: "lead-1", name: "Лид весны", campaignId: "campaign-1" }),
    aLead({ id: "lead-2", name: "Лид лета", campaignId: "campaign-2" }),
  ])),
);

const setup = (route = "/crm") => renderWithProviders(<Routes><Route path="/crm" element={<CrmLayout />}><Route index element={<CrmPage />} /></Route></Routes>, { route });

describe("the CRM campaign select", () => {
  afterEach(() => localStorage.clear());

  it("limits the leads to the chosen campaign and restores them on all campaigns", async () => {
    saveCampaignCrm("user-1", true);
    serve();
    setup();

    expect(await screen.findByText("Лид весны")).toBeInTheDocument();
    expect(screen.getByText("Лид лета")).toBeInTheDocument();

    await userEvent.click(await screen.findByLabelText("Кампания", { selector: "button" }));
    expect(await screen.findByRole("option", { name: "Летняя" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Старая" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Летняя" }));

    expect(await screen.findByText("Лид лета")).toBeInTheDocument();
    expect(screen.queryByText("Лид весны")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Кампания", { selector: "button" }));
    await userEvent.click(await screen.findByRole("option", { name: "Все кампании" }));

    expect(await screen.findByText("Лид весны")).toBeInTheDocument();
  });

  it("reads the campaign from the address", async () => {
    saveCampaignCrm("user-1", true);
    serve();
    setup("/crm?board=project-1&campaign=campaign-1");

    expect(await screen.findByText("Лид весны")).toBeInTheDocument();
    expect(screen.queryByText("Лид лета")).not.toBeInTheDocument();
  });

  it("shows no campaign select and no scope while the preference is off", async () => {
    serve();
    setup("/crm?board=project-1&campaign=campaign-1");

    expect(await screen.findByText("Лид лета")).toBeInTheDocument();
    expect(screen.getByText("Лид весны")).toBeInTheDocument();
    expect(screen.queryByLabelText("Кампания", { selector: "button" })).not.toBeInTheDocument();
  });
});
