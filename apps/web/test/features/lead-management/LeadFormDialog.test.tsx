import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { LeadFormDialog } from "@/features/lead-management/index.js";
import type { Lead } from "@/entities/lead/index.js";

const capabilities = { create: true, update: true, delete: true };

const aLead = (fields: Partial<Lead> = {}): Lead => ({
  id: "lead-1", orgId: "org-1", clientId: null, name: "Анна", company: null,
  phone: null, email: null, website: null, source: null, notes: null,
  projectId: null, campaignId: null, stage: "NEW", position: 0,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
  ...fields,
});

const project = (id: string, name: string, clientId = "client-1") => ({
  id, clientId, name, niche: null, monthlyBudget: null, budgetCurrency: "BYN",
  priority: "NEW", image: null, avatarPath: null, position: 0,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
});

function catalogue() {
  server.use(
    mock.get("/api/projects", ({ request }) => {
      const clientId = new URL(request.url).searchParams.get("clientId");
      const all = [project("project-1", "Летний запуск"), project("project-2", "Осень", "client-2")];
      return HttpResponse.json(clientId ? all.filter((p) => p.clientId === clientId) : all);
    }),
    mock.get("/api/projects/project-1/campaigns/names", () => HttpResponse.json([
      { id: "campaign-1", name: "Поиск", channel: "YANDEX" },
    ])),
    mock.get("/api/projects/project-2/campaigns/names", () => HttpResponse.json([
      { id: "campaign-2", name: "Осенний охват", channel: "META" },
    ])),
  );
}

const setup = (props: Partial<Parameters<typeof LeadFormDialog>[0]> = {}) =>
  renderWithProviders(
    <LeadFormDialog boardKey="agency" capabilities={capabilities} onClose={() => {}} {...props} />,
    { route: "/crm" },
  );

describe("the lead form's fields", () => {
  it("asks for no Telegram of its own", async () => {
    catalogue();
    setup();

    await screen.findByLabelText("Имя / название");
    expect(screen.queryByLabelText("Telegram")).not.toBeInTheDocument();
  });

  it("offers every project of the organization on the agency board", async () => {
    catalogue();
    setup();

    const projects = await screen.findByLabelText("Проект");
    await waitFor(() =>
      expect(within(projects).getByRole("option", { name: "Летний запуск" })).toBeInTheDocument());
    expect(within(projects).getByRole("option", { name: "Осень" })).toBeInTheDocument();
  });

  it("offers only that client's projects on a client's board", async () => {
    catalogue();
    setup({ boardKey: "client-1" });

    const projects = await screen.findByLabelText("Проект");
    await waitFor(() =>
      expect(within(projects).getByRole("option", { name: "Летний запуск" })).toBeInTheDocument());
    expect(within(projects).queryByRole("option", { name: "Осень" })).not.toBeInTheDocument();
  });

  it("fills the campaigns from the chosen project", async () => {
    catalogue();
    setup();

    const projects = await screen.findByLabelText("Проект");
    await waitFor(() =>
      expect(within(projects).getByRole("option", { name: "Летний запуск" })).toBeInTheDocument());
    await userEvent.selectOptions(projects, "project-1");
    const campaigns = screen.getByLabelText("Кампания");
    await waitFor(() =>
      expect(within(campaigns).getByRole("option", { name: "Поиск" })).toBeInTheDocument());
  });

  it("releases the campaign when the project changes", async () => {
    catalogue();
    setup({ lead: aLead({ projectId: "project-1", campaignId: "campaign-1" }) });

    const campaigns = await screen.findByLabelText("Кампания");
    await waitFor(() => expect(campaigns).toHaveValue("campaign-1"));

    await waitFor(() => expect(
      within(screen.getByLabelText("Проект")).getByRole("option", { name: "Осень" }),
    ).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText("Проект"), "project-2");
    await waitFor(() => expect(screen.getByLabelText("Кампания")).toHaveValue(""));
  });

  it("sends the attribution it was given", async () => {
    catalogue();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/crm/boards/agency/leads", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(aLead({ id: "new" }), { status: 201 });
    }));
    setup();

    await userEvent.type(await screen.findByLabelText("Имя / название"), "Борис");
    await waitFor(() => expect(
      within(screen.getByLabelText("Проект")).getByRole("option", { name: "Летний запуск" }),
    ).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText("Проект"), "project-1");
    await waitFor(() => expect(screen.getByLabelText("Кампания")).not.toBeDisabled());
    await userEvent.selectOptions(screen.getByLabelText("Кампания"), "campaign-1");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ name: "Борис", projectId: "project-1", campaignId: "campaign-1" });
  });
});

describe("how the lead form reports a refusal", () => {
  it("raises an alert outside the form and leaves the entered values alone", async () => {
    catalogue();
    server.use(mock.post("/api/crm/boards/agency/leads", () =>
      HttpResponse.json({ error: { message: "Клиент уже заведён" } }, { status: 409 })));
    setup();

    const name = await screen.findByLabelText("Имя / название");
    await userEvent.type(name, "Борис");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Клиент уже заведён");
    expect(screen.getByRole("dialog")).not.toContainElement(alert);
    expect(name).toHaveValue("Борис");
  });

});
