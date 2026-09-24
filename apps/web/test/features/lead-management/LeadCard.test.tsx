import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { LeadCard } from "@/features/lead-management/index.js";
import type { Lead } from "@/entities/lead/index.js";

const capabilities = { create: true, update: true, delete: true };
const readOnly = { create: false, update: false, delete: false };
const BOARD = "/api/crm/boards/project-1";

const aLead = (fields: Partial<Lead> = {}): Lead => ({
  id: "lead-1", orgId: "org-1", name: "Леонид", company: null,
  phone: null, email: null, website: null, source: null, notes: null,
  amount: null, service: null, telegram: null, messenger: null, tags: [],
  projectId: "project-1", campaignId: null, adId: null, origin: "MANUAL", ad: null, metaSource: null, stage: "NEW", position: 0,
  assigneeId: null, assignee: null, project: { id: "project-1", clientId: "client-1", name: "Сайт" },
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
  ...fields,
});

const anImportedLead = (fields: Partial<Lead> = {}): Lead => aLead({
  phone: "+375291234567", origin: "META", campaignId: "campaign-1", adId: "ad-1",
  ad: { id: "ad-1", name: "Видео 1", externalId: "555" },
  metaSource: {
    accountId: "123456", formId: "777888",
    campaign: { externalId: "c1", name: "Весна" },
    adSet: { externalId: "s1", name: "Москва 25–45" },
    ad: { externalId: "555", name: "Видео 1" },
    submittedAt: "2026-09-10T10:00:00.000Z",
    answers: [{ question: "full_name", values: ["Анна"] }],
    answersOmitted: false,
  },
  ...fields,
});

function catalogue(boardLeads: Lead[] = []) {
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([{
      id: "project-1", clientId: "client-1", name: "Сайт", budgetCurrency: "BYN",
      priority: "NEW", image: null, avatarPath: null, position: 0,
      createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
    }])),
    mock.get("/api/projects/project-1/campaigns/names", () => HttpResponse.json([
      { id: "campaign-1", name: "Поиск", channel: "YANDEX" },
    ])),
    mock.get("/api/members", ({ request }) => {
      const clientId = new URL(request.url).searchParams.get("clientId");
      return HttpResponse.json(clientId === "client-1" ? [{
        id: "member-1", userId: "user-1", name: "Женя Радюк", email: "zhenya@example.com",
        image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE",
        createdAt: "2026-09-05T00:00:00.000Z",
      }] : []);
    }),
    mock.get(`${BOARD}/leads`, () => HttpResponse.json(boardLeads)),
    mock.get(`${BOARD}/leads/:id/activity`, () => HttpResponse.json([])),
    mock.get(`${BOARD}/leads/:id/files`, () => HttpResponse.json([])),
  );
}

const setup = (props: Partial<Parameters<typeof LeadCard>[0]> = {}) =>
  renderWithProviders(
    <LeadCard boardKey="project-1" capabilities={capabilities} onClose={() => {}} {...props} />,
    { route: "/crm" },
  );

const ROWS = [
  "Сумма сделки", "Ответственный", "Компания", "Метки", "Услуга", "Номер телефона",
  "Telegram", "Мессенджер", "Email", "Сайт", "Источник",
];

describe("the lead card's left column", () => {
  it("lists the fields in the agreed order, then the description", async () => {
    catalogue();
    setup({ lead: aLead() });

    const fields = await screen.findByRole("list", { name: "Поля лида" });
    const labels = within(fields).getAllByRole("listitem").map((row) => row.getAttribute("data-field"));
    expect(labels).toEqual(ROWS);
    expect(screen.getByLabelText("Описание")).toBeInTheDocument();
    expect(screen.queryByLabelText("Кампания")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Вид сайта")).not.toBeInTheDocument();
  });

  it("shows the stage choice above the name", async () => {
    catalogue();
    setup({ lead: aLead() });

    expect(await screen.findByLabelText("Этап")).toHaveTextContent("Новый");
    expect(screen.getByLabelText("Имя / название")).toHaveValue("Леонид");
  });

  it("shows the deal amount as a plain number, with no currency sign", async () => {
    catalogue();
    setup({ lead: aLead({ amount: "1500.5000" }) });

    const amount = await screen.findByLabelText("Сумма сделки");
    expect(amount).toHaveValue("1500.5");
    expect(amount.closest("li")).not.toHaveTextContent(/Br|\$|₽|€/);
  });

  it("offers the employees of the board project's client", async () => {
    catalogue();
    setup();

    await waitFor(() => expect(screen.getByLabelText("Ответственный")).not.toBeDisabled());
    await userEvent.click(screen.getByLabelText("Ответственный"));
    expect(await screen.findByRole("option", { name: /Женя Радюк/ })).toBeInTheDocument();
  });
});

describe("creating a lead from the card", () => {
  it("stores every field entered only when Создать is pressed, and keeps the card open on the saved lead", async () => {
    catalogue();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post(`${BOARD}/leads`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(aLead({ id: "new", ...(body as Partial<Lead>) }), { status: 201 });
    }));
    const onClose = vi.fn();
    setup({ onClose });

    await userEvent.type(await screen.findByLabelText("Имя / название"), "Леонид");
    await userEvent.type(screen.getByLabelText("Сумма сделки"), "1 500,50");
    await userEvent.type(screen.getByLabelText("Услуга"), "Лендинг");
    await userEvent.type(screen.getByLabelText("Номер телефона"), "+375290000000");
    await userEvent.type(screen.getByLabelText("Telegram"), "@leonid");
    await userEvent.type(screen.getByLabelText("Мессенджер"), "WhatsApp");
    await userEvent.type(screen.getByLabelText("Описание"), "Хочет сайт");
    expect(body).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      name: "Леонид", amount: "1500.50", service: "Лендинг",
      phone: "+375290000000", telegram: "@leonid", messenger: "WhatsApp", notes: "Хочет сайт", stage: "NEW",
    });
    expect(await screen.findByRole("button", { name: "Сохранить" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Активность" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("refuses an amount that is not a number", async () => {
    catalogue();
    let posted = false;
    server.use(mock.post(`${BOARD}/leads`, () => { posted = true; return HttpResponse.json(aLead(), { status: 201 }); }));
    setup();

    await userEvent.type(await screen.findByLabelText("Имя / название"), "Леонид");
    await userEvent.type(screen.getByLabelText("Сумма сделки"), "много");
    await userEvent.click(screen.getByRole("button", { name: "Создать" }));

    expect(await screen.findByText("Введите сумму числом")).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("shows the left column alone while the lead is being created", async () => {
    catalogue();
    setup();

    expect(await screen.findByLabelText("Имя / название")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Разделы лида" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Прикрепить файл")).not.toBeInTheDocument();
  });

  it("offers Активность and Файлы for a stored lead, and nothing else for a hand-made one", async () => {
    catalogue();
    setup({ lead: aLead() });

    const tabs = await screen.findByRole("radiogroup", { name: "Разделы лида" });
    expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Активность", "Файлы"]);
  });

  it("raises an alert outside the card and leaves the entered values alone when refused", async () => {
    catalogue();
    server.use(mock.post(`${BOARD}/leads`, () =>
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

describe("tags", () => {
  it("adds a tag suggested from the board and removes one", async () => {
    catalogue([aLead({ id: "other", tags: ["Срочно"] })]);
    let body: Record<string, unknown> | null = null;
    server.use(mock.patch(`${BOARD}/leads/lead-1`, async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json(aLead());
    }));
    setup({ lead: aLead({ tags: ["VIP"] }) });

    await userEvent.click(await screen.findByRole("button", { name: "Добавить метку" }));
    const input = screen.getByLabelText("Новая метка");
    await waitFor(() => expect(screen.getByTestId("tag-suggestions").querySelector('option[value="Срочно"]')).not.toBeNull());
    await userEvent.type(input, "Срочно{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Убрать метку VIP" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ tags: ["Срочно"] });
  });

  it("does not add the same tag twice", async () => {
    catalogue();
    setup({ lead: aLead({ tags: ["VIP"] }) });

    await userEvent.click(await screen.findByRole("button", { name: "Добавить метку" }));
    await userEvent.type(screen.getByLabelText("Новая метка"), "vip{Enter}");

    expect(screen.getAllByRole("button", { name: /Убрать метку/ })).toHaveLength(1);
  });
});

describe("editing a lead", () => {
  it("saves only when Сохранить is pressed and moves the lead to the chosen stage", async () => {
    catalogue();
    let body: Record<string, unknown> | null = null;
    let moved: unknown;
    server.use(
      mock.patch(`${BOARD}/leads/lead-1`, async ({ request }) => {
        body = await request.json() as Record<string, unknown>;
        return HttpResponse.json(aLead());
      }),
      mock.patch(`${BOARD}/leads/lead-1/move`, async ({ request }) => {
        moved = await request.json();
        return HttpResponse.json([aLead({ stage: "PROPOSAL" })]);
      }),
    );
    const onClose = vi.fn();
    setup({ lead: aLead(), onClose });

    await userEvent.type(await screen.findByLabelText("Компания"), "Балаган");
    await userEvent.click(screen.getByLabelText("Этап"));
    await userEvent.click(await screen.findByRole("option", { name: "КП" }));
    expect(body).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(moved).toEqual({ stage: "PROPOSAL", position: 2147483647 }));
    expect(body).toMatchObject({ name: "Леонид", company: "Балаган" });
    expect(body).not.toHaveProperty("projectId");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows every value and no control to a guest", async () => {
    catalogue();
    setup({ lead: aLead({ phone: "+375290000000", tags: ["VIP"] }), capabilities: readOnly });

    expect(await screen.findByLabelText("Номер телефона")).toBeDisabled();
    expect(screen.getByLabelText("Номер телефона")).toHaveValue("+375290000000");
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить метку" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();
  });

  it("deletes the lead only once confirmed", async () => {
    catalogue();
    let deleted = false;
    server.use(mock.delete(`${BOARD}/leads/lead-1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
    setup({ lead: aLead() });

    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));
    expect(deleted).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Удалить лид" }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it("keeps what the integration delivered in a Доп. информация tab", async () => {
    catalogue();
    setup({ lead: anImportedLead() });

    const tabs = await screen.findByRole("radiogroup", { name: "Разделы лида" });
    expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Активность", "Файлы", "Доп. информация"]);
    expect(screen.queryByRole("region", { name: "Источник: Meta" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Доп. информация" }));
    const source = await screen.findByRole("region", { name: "Источник: Meta" });
    for (const text of ["123456", "777888", "Весна", "Москва 25–45", "Видео 1", "Анна"]) {
      expect(within(source).getByText(text)).toBeInTheDocument();
    }
    expect(within(source).queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Номер телефона")).not.toBeDisabled();
  });
});

describe("the activity tab", () => {
  it("tells what happened, newest first, in words", async () => {
    catalogue();
    server.use(mock.get(`${BOARD}/leads/lead-1/activity`, () => HttpResponse.json([
      { id: "e4", kind: "file-added", actor: { name: "Женя Радюк" }, at: "2026-09-12T10:00:00.000Z", file: { name: "Смета.xlsx" } },
      { id: "e3", kind: "moved", actor: { name: "Мария" }, at: "2026-09-11T10:00:00.000Z", stage: { from: "Новый", to: "КП" } },
      { id: "e2", kind: "changed", actor: { name: "Мария" }, at: "2026-09-10T11:00:00.000Z", changes: [
        { field: "phone", before: "+375290000000", after: "+375291111111" },
        { field: "tags", before: "", after: "Срочно" },
      ] },
      { id: "e1", kind: "created", actor: { name: "Женя Радюк" }, at: "2026-09-10T10:00:00.000Z" },
    ])));
    setup({ lead: aLead() });

    const feed = await screen.findByRole("list", { name: "Активность" });
    const entries = within(feed).getAllByRole("listitem");
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent("Женя Радюк");
    expect(entries[0]).toHaveTextContent("Файл добавлен: Смета.xlsx");
    expect(entries[1]).toHaveTextContent("Этап: Новый → КП");
    expect(entries[2]).toHaveTextContent("Номер телефона: +375290000000 → +375291111111");
    expect(entries[2]).toHaveTextContent("Метки: — → Срочно");
    expect(entries[3]).toHaveTextContent("Лид создан");
  });

  it("says an imported lead arrived from Meta, naming no one", async () => {
    catalogue();
    server.use(mock.get(`${BOARD}/leads/lead-1/activity`, () => HttpResponse.json([
      { id: "imported-lead-1", kind: "imported", actor: null, at: "2026-09-10T10:00:00.000Z" },
    ])));
    setup({ lead: anImportedLead() });

    const feed = await screen.findByRole("list", { name: "Активность" });
    expect(within(feed).getByRole("listitem")).toHaveTextContent("Лид пришёл из Meta");
  });
});

describe("the files tab", () => {
  const withFiles = (files: unknown[]) => server.use(mock.get(`${BOARD}/leads/lead-1/files`, () => HttpResponse.json(files)));
  const contract = { id: "file-1", leadId: "lead-1", name: "Договор.pdf", contentType: "application/pdf", bytes: 2048, uploader: { id: "member-1", name: "Женя Радюк" }, createdAt: "2026-09-12T10:00:00.000Z" };

  it("lists the files with their size and who added them", async () => {
    catalogue();
    withFiles([contract]);
    setup({ lead: aLead() });

    await userEvent.click(await screen.findByRole("radio", { name: "Файлы" }));
    const list = await screen.findByRole("list", { name: "Файлы" });
    const row = within(list).getByRole("listitem");
    expect(row).toHaveTextContent("Договор.pdf");
    expect(row).toHaveTextContent("2 КБ");
    expect(row).toHaveTextContent("Женя Радюк");
    expect(within(row).getByRole("button", { name: "Скачать Договор.pdf" })).toBeInTheDocument();
  });

  it("attaches a file", async () => {
    catalogue();
    let uploaded = false;
    server.use(mock.post(`${BOARD}/leads/lead-1/files`, () => {
      uploaded = true;
      return HttpResponse.json(contract, { status: 201 });
    }));
    setup({ lead: aLead() });

    await userEvent.click(await screen.findByRole("radio", { name: "Файлы" }));
    await userEvent.upload(screen.getByLabelText("Прикрепить файл"), new File(["pdf"], "Договор.pdf", { type: "application/pdf" }));

    await waitFor(() => expect(uploaded).toBe(true));
  });

  it("removes a file once confirmed", async () => {
    catalogue();
    withFiles([contract]);
    let removed = false;
    server.use(mock.delete(`${BOARD}/leads/lead-1/files/file-1`, () => { removed = true; return new HttpResponse(null, { status: 204 }); }));
    setup({ lead: aLead() });

    await userEvent.click(await screen.findByRole("radio", { name: "Файлы" }));
    await userEvent.click(await screen.findByRole("button", { name: "Удалить Договор.pdf" }));
    expect(removed).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Удалить файл" }));
    await waitFor(() => expect(removed).toBe(true));
  });

  it("lets a guest download but not attach or remove", async () => {
    catalogue();
    withFiles([contract]);
    setup({ lead: aLead(), capabilities: readOnly });

    await userEvent.click(await screen.findByRole("radio", { name: "Файлы" }));
    expect(await screen.findByRole("button", { name: "Скачать Договор.pdf" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Прикрепить файл")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить Договор.pdf" })).not.toBeInTheDocument();
  });
});
