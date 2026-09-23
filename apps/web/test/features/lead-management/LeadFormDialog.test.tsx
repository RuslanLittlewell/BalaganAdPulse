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
  projectId: null, campaignId: null, adId: null, origin: "MANUAL", ad: null, metaSource: null, stage: "NEW", position: 0,
  assigneeId: null, assignee: null, project: null,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
  ...fields,
});

const anImportedLead = (fields: Partial<Lead> = {}): Lead => aLead({
  clientId: "client-1", phone: "+375291234567", origin: "META",
  projectId: "project-1", campaignId: "campaign-1", adId: "ad-1",
  ad: { id: "ad-1", name: "Видео 1", externalId: "555" },
  metaSource: {
    accountId: "123456", formId: "777888",
    campaign: { externalId: "c1", name: "Весна" },
    adSet: { externalId: "s1", name: "Москва 25–45" },
    ad: { externalId: "555", name: "Видео 1" },
    submittedAt: "2026-09-10T10:00:00.000Z",
    answers: [
      { question: "full_name", values: ["Анна"] },
      { question: "какой_у_вас_бюджет?", values: ["до 1000", "срочно"] },
    ],
    answersOmitted: false,
  },
  ...fields,
});

const project = (id: string, name: string, clientId = "client-1") => ({
  id, clientId, name, budgetCurrency: "BYN",
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
    mock.get("/api/members", ({ request }) => {
      const clientId = new URL(request.url).searchParams.get("clientId");
      return HttpResponse.json(clientId === "client-1" ? [{
        id: "member-1", userId: "user-1", name: "Мария", email: "maria@example.com",
        image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE",
        createdAt: "2026-09-05T00:00:00.000Z",
      }] : []);
    }),
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

    await userEvent.click(await screen.findByLabelText("Проект"));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Летний запуск" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Осень" })).toBeInTheDocument();
  });

  it("offers only that client's projects on a client's board", async () => {
    catalogue();
    setup({ boardKey: "client-1" });

    await userEvent.click(await screen.findByLabelText("Проект"));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Летний запуск" })).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: "Осень" })).not.toBeInTheDocument();
  });

  it("fills the campaigns from the chosen project", async () => {
    catalogue();
    setup();

    await userEvent.click(await screen.findByLabelText("Проект"));
    await userEvent.click(await screen.findByRole("option", { name: "Летний запуск" }));
    await waitFor(() => expect(screen.getByLabelText("Кампания")).not.toBeDisabled());

    await userEvent.click(screen.getByLabelText("Кампания"));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Поиск" })).toBeInTheDocument());
  });

  it("releases the campaign when the project changes", async () => {
    catalogue();
    setup({ lead: aLead({ projectId: "project-1", campaignId: "campaign-1" }) });

    const campaigns = await screen.findByLabelText("Кампания");
    await waitFor(() => expect(campaigns).toHaveTextContent("Поиск"));

    await userEvent.click(screen.getByLabelText("Проект"));
    await userEvent.click(await screen.findByRole("option", { name: "Осень" }));
    await waitFor(() => expect(screen.getByLabelText("Кампания")).toHaveTextContent("Не указана"));
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
    await userEvent.click(screen.getByLabelText("Проект"));
    await userEvent.click(await screen.findByRole("option", { name: "Летний запуск" }));
    await waitFor(() => expect(screen.getByLabelText("Кампания")).not.toBeDisabled());

    await userEvent.click(screen.getByLabelText("Кампания"));
    await userEvent.click(await screen.findByRole("option", { name: "Поиск" }));
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ name: "Борис", projectId: "project-1", campaignId: "campaign-1" });
  });

  it("assigns an active employee of the selected project's client", async () => {
    catalogue();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/crm/boards/agency/leads", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(aLead({ id: "new" }), { status: 201 });
    }));
    setup();

    await userEvent.type(await screen.findByLabelText("Имя / название"), "Борис");
    expect(screen.getByLabelText("Ответственный")).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Проект"));
    await userEvent.click(await screen.findByRole("option", { name: "Летний запуск" }));
    await waitFor(() => expect(screen.getByLabelText("Ответственный")).not.toBeDisabled());
    await userEvent.click(screen.getByLabelText("Ответственный"));
    await userEvent.click(await screen.findByRole("option", { name: /Мария/ }));
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ projectId: "project-1", assigneeId: "member-1" });
  });
});

describe("the lead form's stage choice", () => {
  const withMeeting = () => server.use(
    mock.get("/api/crm/boards/agency/columns", () => HttpResponse.json([
      { id: "NEW", kind: "FIXED", name: "Новый", position: 0 },
      { id: "QUALIFIED", kind: "FIXED", name: "Квалифицированный", position: 1 },
      { id: "TARGET", kind: "FIXED", name: "Целевой", position: 2 },
      { id: "PROPOSAL", kind: "FIXED", name: "КП", position: 3 },
      { id: "col-1", kind: "CUSTOM", name: "Встреча", position: 0 },
    ])),
  );

  it("lists every fixed stage and custom column of the board in board order", async () => {
    catalogue();
    withMeeting();
    setup();

    await userEvent.click(await screen.findByLabelText("Этап"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Встреча" })).toBeInTheDocument());
    expect(screen.getAllByRole("option").map((option) => option.textContent))
      .toEqual(["Новый", "Квалифицированный", "Целевой", "КП", "Встреча"]);
  });

  it("shows the custom column a lead sits in and moves it to the chosen one", async () => {
    catalogue();
    withMeeting();
    let moved: unknown;
    server.use(
      mock.patch("/api/crm/boards/agency/leads/lead-1", () => HttpResponse.json(aLead({ stage: "col-1" }))),
      mock.patch("/api/crm/boards/agency/leads/lead-1/move", async ({ request }) => {
        moved = await request.json();
        return HttpResponse.json([aLead({ stage: "TARGET" })]);
      }),
    );
    setup({ lead: aLead({ stage: "col-1" }) });

    const stage = await screen.findByLabelText("Этап");
    await waitFor(() => expect(stage).toHaveTextContent("Встреча"));
    await userEvent.click(stage);
    await userEvent.click(await screen.findByRole("option", { name: "Целевой" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(moved).toEqual({ stage: "TARGET", position: 2147483647 }));
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

describe("an imported lead in the form", () => {
  it("shows where it came from, read-only", async () => {
    catalogue();
    setup({ boardKey: "client-1", lead: anImportedLead() });

    const source = await screen.findByRole("region", { name: "Источник: Meta" });
    for (const text of ["123456", "777888", "Весна", "Москва 25–45", "Видео 1", "Имя", "Анна", "Какой у вас бюджет?", "до 1000 · срочно"]) {
      expect(within(source).getByText(text)).toBeInTheDocument();
    }
    expect(within(source).getByText(/10\.09\.2026/)).toBeInTheDocument();
    expect(within(source).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(source).queryByText("Часть ответов не сохранена")).not.toBeInTheDocument();
  });

  it("says when some answers were not kept", async () => {
    catalogue();
    setup({ boardKey: "client-1", lead: anImportedLead({ metaSource: { ...anImportedLead().metaSource!, answersOmitted: true } }) });

    const source = await screen.findByRole("region", { name: "Источник: Meta" });
    expect(within(source).getByText("Часть ответов не сохранена")).toBeInTheDocument();
  });

  it("shows no manually editable contact fields and only saves the retained fields", async () => {
    catalogue();
    let body: Record<string, unknown> | null = null;
    server.use(mock.patch("/api/crm/boards/client-1/leads/lead-1", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(anImportedLead());
    }));
    setup({ boardKey: "client-1", lead: anImportedLead() });

    await waitFor(() => expect(screen.getByLabelText("Кампания")).toHaveTextContent("Поиск"));
    expect(screen.getByLabelText("Проект")).toBeDisabled();
    expect(screen.getByLabelText("Кампания")).toBeDisabled();
    expect(screen.queryByLabelText("Телефон")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Компания")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Имя / название")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Заметки"), "Перезвонить");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ notes: "Перезвонить", projectId: "project-1", campaignId: "campaign-1", assigneeId: null });
  });

  it("shows no source for a lead made by hand", async () => {
    catalogue();
    setup({ lead: aLead() });

    expect(await screen.findByRole("heading", { name: "Анна" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Источник: Meta" })).not.toBeInTheDocument();
  });

  it("shows the source to a guest who cannot edit anything", async () => {
    catalogue();
    setup({ boardKey: "client-1", lead: anImportedLead(), capabilities: { create: false, update: false, delete: false } });

    expect(await screen.findByRole("region", { name: "Источник: Meta" })).toBeInTheDocument();
    expect(screen.getByLabelText("Заметки")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
  });
});
