import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { freezeDate, renderWithProviders, server } from "@test/shared/index.js";
import { CrmLayout, CrmPage } from "@/pages/crm/index.js";
import { CampaignCrmSwitch } from "@/widgets/crm-nav/index.js";
freezeDate("2026-09-15T12:00:00");

const capabilities = { create: true, update: true, delete: true };

const aLead = (fields: Record<string, unknown>) => ({
  id: "lead-1", orgId: "org-1", projectId: "project-1", project: { id: "project-1", clientId: "client-1", name: "Сайт" }, tags: [], name: "Анна", companyId: null, personId: null, company: null, person: null,
  source: null, notes: null, campaignId: null,
  stage: "NEW", position: 0, createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z", ...fields,
});

const serve = ({ campaignCrm = true, role = "ADMIN" }: { campaignCrm?: boolean; role?: string } = {}) => server.use(
  mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    clientIds: [],
  })),
  mock.get("/api/crm/boards", () => HttpResponse.json([{ key: "project-1", label: "Сайт", clientId: "client-1", clientName: "Ромашка", campaignCrm, capabilities }])),
  mock.get("/api/projects/project-1/campaigns/names", () => HttpResponse.json([
    { id: "campaign-1", name: "Весенняя", channel: "META", status: "ACTIVE" },
    { id: "campaign-2", name: "Летняя", channel: "META", status: "ACTIVE" },
    { id: "campaign-3", name: "Старая", channel: "META", status: "PAUSED" },
  ])),
  mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json([
    aLead({ id: "lead-1", name: "Лид весны", campaignId: "campaign-1" }),
    aLead({ id: "lead-2", name: "Лид лета", campaignId: "campaign-2" }),
    aLead({ id: "lead-3", name: "Лид старой", campaignId: "campaign-3" }),
    aLead({ id: "lead-4", name: "Лид без кампании", campaignId: null }),
  ])),
);

const setup = (route = "/crm") => renderWithProviders(<Routes><Route path="/crm" element={<CrmLayout />}><Route index element={<CrmPage />} /></Route></Routes>, { route });
const setupWithSwitch = () => renderWithProviders(<><CampaignCrmSwitch /><Routes><Route path="/crm" element={<CrmLayout />}><Route index element={<CrmPage />} /></Route></Routes></>, { route: "/crm" });

describe("the CRM campaign select", () => {
  afterEach(() => localStorage.clear());

  const select = () => screen.getByLabelText("Кампания", { selector: "button" });
  const leadsSection = () => screen.getByRole("link", { name: /Лиды/ });

  it("limits the leads to the checked campaigns and restores them on all campaigns", async () => {
    serve();
    setup();

    expect(await screen.findByText("Лид весны")).toBeInTheDocument();
    expect(screen.getByText("Лид без кампании")).toBeInTheDocument();
    expect(await screen.findByLabelText("Кампания", { selector: "button" })).toHaveTextContent("Все кампании");

    await userEvent.click(select());
    expect(await screen.findByRole("menuitemcheckbox", { name: "Все кампании" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Летняя" }));

    expect(await screen.findByText("Лид лета")).toBeInTheDocument();
    expect(screen.queryByText("Лид весны")).not.toBeInTheDocument();
    expect(screen.queryByText("Лид без кампании")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Весенняя" }));

    expect(await screen.findByText("Лид весны")).toBeInTheDocument();
    expect(screen.getByText("Лид лета")).toBeInTheDocument();
    expect(screen.queryByText("Лид старой")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "Летняя" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Весенняя" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Все кампании" })).toHaveAttribute("aria-checked", "false");

    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "Все кампании" }));

    expect(await screen.findByText("Лид без кампании")).toBeInTheDocument();
    expect(screen.getByText("Лид старой")).toBeInTheDocument();
  });

  it("lists stopped campaigns after the running ones and scopes to them", async () => {
    serve();
    setup();

    await screen.findByText("Лид весны");
    await userEvent.click(await screen.findByLabelText("Кампания", { selector: "button" }));

    const names = (await screen.findAllByRole("menuitemcheckbox")).map((option) => option.textContent);
    expect(names).toEqual(["Все кампании", "Весенняя", "Летняя", "Старая"]);
    const stopped = screen.getByRole("menuitemcheckbox", { name: "Старая" });
    expect(stopped.querySelector("[data-running]")).toHaveAttribute("data-running", "false");

    await userEvent.click(stopped);

    expect(await screen.findByText("Лид старой")).toBeInTheDocument();
    expect(screen.queryByText("Лид весны")).not.toBeInTheDocument();
  });

  it("reads the campaign from the address", async () => {
    serve();
    setup("/crm?board=project-1&campaign=campaign-1");

    expect(await screen.findByText("Лид весны")).toBeInTheDocument();
    expect(screen.queryByText("Лид лета")).not.toBeInTheDocument();
  });

  it("reads several campaigns from the address and keeps them in the leads link", async () => {
    serve();
    setup("/crm?board=project-1&campaign=campaign-1&campaign=campaign-3");

    expect(await screen.findByText("Лид весны")).toBeInTheDocument();
    expect(screen.getByText("Лид старой")).toBeInTheDocument();
    expect(screen.queryByText("Лид лета")).not.toBeInTheDocument();
    expect(select()).toHaveTextContent("Весенняя");
    expect(select()).toHaveTextContent("+1");
    expect(leadsSection()).toHaveAttribute("href", "/crm?board=project-1&campaign=campaign-1&campaign=campaign-3");
    expect(leadsSection()).toHaveTextContent("2");
  });

  it("shows no campaign select and no scope while the project's setting is off", async () => {
    serve({ campaignCrm: false });
    setup("/crm?board=project-1&campaign=campaign-1");

    expect(await screen.findByText("Лид лета")).toBeInTheDocument();
    expect(screen.getByText("Лид весны")).toBeInTheDocument();
    expect(screen.getByText("Лид старой")).toBeInTheDocument();
    expect(screen.queryByLabelText("Кампания", { selector: "button" })).not.toBeInTheDocument();
  });
});

describe("the CRM по кампаниям switch", () => {
  const toggle = () => screen.findByRole("switch", { name: "CRM по кампаниям" });

  it("turns the project's setting on and off and shows the campaign select accordingly", async () => {
    serve({ campaignCrm: false });
    const sent: unknown[] = [];
    let stored = false;
    server.use(
      mock.get("/api/crm/boards", () => HttpResponse.json([{ key: "project-1", label: "Сайт", clientId: "client-1", clientName: "Ромашка", campaignCrm: stored, capabilities }])),
      mock.patch("/api/crm/boards/project-1", async ({ request }) => {
        const body = await request.json() as { campaignCrm: boolean };
        sent.push(body);
        stored = body.campaignCrm;
        return HttpResponse.json({ key: "project-1", label: "Сайт", clientId: "client-1", clientName: "Ромашка", campaignCrm: stored, capabilities });
      }),
    );
    setupWithSwitch();

    expect(await toggle()).not.toBeChecked();
    expect(screen.queryByLabelText("Кампания", { selector: "button" })).not.toBeInTheDocument();

    await userEvent.click(await toggle());

    expect(await screen.findByLabelText("Кампания", { selector: "button" })).toBeInTheDocument();
    expect(await toggle()).toBeChecked();
    await waitFor(() => expect(sent).toEqual([{ campaignCrm: true }]));

    await userEvent.click(await toggle());

    await waitFor(() => expect(screen.queryByLabelText("Кампания", { selector: "button" })).not.toBeInTheDocument());
    expect(sent).toEqual([{ campaignCrm: true }, { campaignCrm: false }]);
  });

  it("is hidden from a guest, who still gets the campaign select of a project worked by campaign", async () => {
    serve({ role: "GUEST" });
    setupWithSwitch();

    expect(await screen.findByLabelText("Кампания", { selector: "button" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "CRM по кампаниям" })).not.toBeInTheDocument();
  });

  it("returns to the stored setting and says so when saving fails", async () => {
    serve({ campaignCrm: false });
    server.use(mock.patch("/api/crm/boards/project-1", () => HttpResponse.json({ error: { message: "Action not permitted" } }, { status: 403 })));
    setupWithSwitch();

    await userEvent.click(await toggle());

    expect(await screen.findByText("Не удалось переключить CRM по кампаниям.")).toBeInTheDocument();
    await waitFor(async () => expect(await toggle()).not.toBeChecked());
    expect(screen.queryByLabelText("Кампания", { selector: "button" })).not.toBeInTheDocument();
  });
});
