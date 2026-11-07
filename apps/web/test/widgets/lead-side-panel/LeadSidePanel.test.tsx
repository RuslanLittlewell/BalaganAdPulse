import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { aLead } from "@test/shared/fixtures.js";
import type { Lead, LeadField } from "@/entities/lead/index.js";
import { LeadSidePanel } from "@/widgets/lead-side-panel/index.js";

const capabilities = { create: true, update: true, delete: true };
const readOnly = { create: false, update: false, delete: false };
const BOARD = "/api/crm/boards/project-1";

const FIELDS: LeadField[] = [
  { id: "budget", name: "Бюджет", type: "NUMBER", options: [], position: 0 },
  { id: "meeting", name: "Встреча", type: "DATE", options: [], position: 1 },
  { id: "segment", name: "Сегмент", type: "SELECT", position: 2, options: [{ id: "o1", name: "Опт", color: "blue" }, { id: "o2", name: "Розница", color: "green" }] },
  { id: "channels", name: "Каналы", type: "MULTI_SELECT", position: 3, options: [{ id: "c1", name: "Сайт", color: "teal" }, { id: "c2", name: "Звонок", color: "orange" }] },
  { id: "qualified", name: "Квалифицирован", type: "CHECKBOX", options: [], position: 4 },
  { id: "brief", name: "Бриф", type: "LINK", options: [], position: 5 },
];

const COLUMNS = [
  { id: "NEW", kind: "FIXED", name: "Новый", position: 0, color: "blue" },
  { id: "QUALIFIED", kind: "FIXED", name: "Квалифицированный", position: 1, color: "purple" },
  { id: "TARGET", kind: "FIXED", name: "Целевой", position: 2, color: "orange" },
  { id: "PROPOSAL", kind: "FIXED", name: "КП", position: 3, color: "green" },
  { id: "col-1", kind: "CUSTOM", name: "Встреча", position: 0, color: "gray" },
];

const theLead = (fields: Partial<Lead> = {}) => aLead({
  id: "lead-1", name: "Леонид", personId: "p1", person: { id: "p1", name: "Леонид", phone: "+375290000000", email: null, telegram: null, messenger: null }, companyId: "c1", company: { id: "c1", name: "Ромашка", website: "https://example.com" }, amount: "1500.5000", tags: ["VIP"],
  createdAt: "2026-03-10T09:00:00.000Z", ...fields,
});

const anImportedLead = (fields: Partial<Lead> = {}) => theLead({
  origin: "META", campaignId: "campaign-1", adId: "ad-1",
  ad: { id: "ad-1", name: "Видео 1", externalId: "555" },
  metaSource: {
    accountId: "123456", formId: "777888",
    campaign: { externalId: "c1", name: "Весна" }, adSet: { externalId: "s1", name: "Москва 25–45" }, ad: { externalId: "555", name: "Видео 1" },
    submittedAt: "2026-09-10T10:00:00.000Z", answers: [{ question: "full_name", values: ["Анна"] }], answersOmitted: false,
  },
  ...fields,
});

function catalogue(lead: Lead = theLead(), { fields = FIELDS, others = [] as Lead[] } = {}) {
  const state = { lead };
  server.use(
    mock.get(`${BOARD}/leads`, () => HttpResponse.json([state.lead, ...others])),
    mock.get(`${BOARD}/fields`, () => HttpResponse.json(fields)),
    mock.get(`${BOARD}/columns`, () => HttpResponse.json(COLUMNS)),
    mock.get("/api/members", () => HttpResponse.json([{
      id: "member-1", userId: "user-1", name: "Женя Радюк", email: "zhenya@example.com",
      image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-05T00:00:00.000Z",
    }])),
    mock.get(`${BOARD}/leads/:id/activity`, () => HttpResponse.json([])),
    mock.get(`${BOARD}/leads/:id/files`, () => HttpResponse.json([])),
    mock.get('/api/crm/clients/client-1/people', () => HttpResponse.json(state.lead.person ? [{ id: state.lead.person.id, name: state.lead.person.name }] : [])),
    mock.get('/api/crm/clients/client-1/companies', () => HttpResponse.json(state.lead.company ? [{ id: state.lead.company.id, name: state.lead.company.name }] : [])),
  );
  return state;
}

function capturePatch(state: { lead: Lead }) {
  const sent: Record<string, unknown>[] = [];
  server.use(mock.patch(`${BOARD}/leads/lead-1`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    sent.push(body);
    const { customValues, contact, organization, ...rest } = body as { customValues?: Record<string, unknown>; contact?: Partial<NonNullable<Lead['person']>>; organization?: Partial<NonNullable<Lead['company']>> };
    const merged = { ...state.lead.customValues, ...customValues };
    for (const key of Object.keys(merged)) if (merged[key] === null) delete merged[key];
    state.lead = { ...state.lead, ...rest,
      person: contact ? { ...state.lead.person!, ...contact } : state.lead.person,
      company: organization ? { ...state.lead.company!, ...organization } : state.lead.company,
      customValues: merged as Lead["customValues"] };
    return HttpResponse.json(state.lead);
  }));
  return sent;
}

const setup = (props: Partial<Parameters<typeof LeadSidePanel>[0]> = {}) =>
  renderWithProviders(
    <LeadSidePanel boardKey="project-1" leadId="lead-1" capabilities={capabilities} onClose={() => {}} {...props} />,
    { route: "/crm" },
  );

const panel = () => screen.getByRole("complementary", { name: "Леонид" });

describe("the panel's layout", () => {
  it("names the lead, shows its stage and groups its fields", async () => {
    catalogue();
    setup();

    expect(await screen.findByRole("complementary", { name: "Леонид" })).toBeInTheDocument();
    expect(within(panel()).getByLabelText("Этап")).toHaveTextContent("Новый");
    expect(await within(panel()).findByLabelText("Бюджет")).toBeInTheDocument();
    const groups = within(panel()).getAllByRole("button", { expanded: true }).map((button) => button.textContent);
    expect(groups).toEqual(["Сделка", "Контакты", "Свои поля", "Описание", "Системные"]);
    expect(within(panel()).getByLabelText("Сумма сделки")).toHaveTextContent("1500.5");
    expect(within(panel()).getByLabelText("Дата поступления")).toHaveTextContent("10.03.2026");
    expect(within(panel()).getByLabelText("Откуда")).toHaveTextContent("Вручную");
    expect(within(panel()).queryByLabelText("Кампания")).toBeNull();
  });

  it("omits Свои поля on a board without custom fields and collapses a group", async () => {
    catalogue(theLead(), { fields: [] });
    setup();

    const deal = await screen.findByRole("button", { name: "Сделка" });
    expect(screen.queryByRole("button", { name: "Свои поля" })).toBeNull();
    await userEvent.click(deal);
    expect(deal).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Сумма сделки")).toBeNull();
  });

  it("offers Поля, Активность and Файлы for a hand-made lead", async () => {
    catalogue();
    setup();

    const tabs = await screen.findByRole("radiogroup", { name: "Разделы лида" });
    expect(within(tabs).getAllByRole("radio").map((tab) => tab.textContent)).toEqual(["Поля", "Активность", "Файлы"]);
  });

  it("keeps what the integration delivered in Информация", async () => {
    catalogue(anImportedLead());
    setup();

    await userEvent.click(await screen.findByRole("radio", { name: "Информация" }));
    const source = await screen.findByRole("region", { name: "Источник: Meta" });
    for (const text of ["123456", "777888", "Весна", "Москва 25–45", "Видео 1", "Анна"]) {
      expect(within(source).getByText(text)).toBeInTheDocument();
    }
    expect(within(source).queryByRole("textbox")).toBeNull();
  });

  it("renders nothing for a lead that is not on the board", async () => {
    catalogue();
    setup({ leadId: "elsewhere" });

    await waitFor(() => expect(screen.queryByRole("complementary")).toBeNull());
  });

  it("closes on Escape and on its close button", async () => {
    catalogue();
    const onClose = vi.fn();
    setup({ onClose });

    await screen.findByRole("complementary", { name: "Леонид" });
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("saving one value at a time", () => {
  it("picks an existing contact and requests the organization creation panel", async () => {
    const state = catalogue(theLead({ personId: null, person: null, companyId: null, company: null }));
    const sent = capturePatch(state);
    const onCreateRecord = vi.fn();
    server.use(
      mock.get('/api/crm/clients/client-1/people', () => HttpResponse.json([{ id: 'p2', name: 'Анна' }])),
    );
    setup({ onCreateRecord });
    await userEvent.click(await screen.findByRole('combobox', { name: 'Контакт' }));
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Поиск' }), 'Ан');
    await userEvent.click(await screen.findByRole('option', { name: 'Анна' }));
    await waitFor(() => expect(sent).toContainEqual({ personId: 'p2' }));
    const organization = panel().querySelector('[data-field="company"]') as HTMLElement;
    await userEvent.click(within(organization).getByRole('button', { name: 'Добавить Организация' }));
    expect(onCreateRecord).toHaveBeenCalledWith('companies');
  });

  it("sends a phone on an unlinked lead as contact values", async () => {
    const state = catalogue(theLead({ personId: null, person: null }));
    const sent = capturePatch(state);
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Номер телефона' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Номер телефона' }), '+375291112233{Enter}');
    await waitFor(() => expect(sent).toEqual([{ contact: { phone: '+375291112233' } }]));
  });

  it("stores only the phone when Enter is pressed", async () => {
    const state = catalogue();
    const sent = capturePatch(state);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Номер телефона" }));
    const input = screen.getByRole("textbox", { name: "Номер телефона" });
    await userEvent.clear(input);
    await userEvent.type(input, "+375291112233{Enter}");

    await waitFor(() => expect(sent).toEqual([{ contact: { phone: "+375291112233" } }]));
    expect(await screen.findByRole("button", { name: "Номер телефона" })).toHaveTextContent("+375291112233");
  });

  it("stores the description when it is left, and Enter adds a line", async () => {
    const state = catalogue();
    const sent = capturePatch(state);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Текст описания" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Текст описания" }), "Первая{Enter}Вторая");
    expect(sent).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Услуга" }));

    await waitFor(() => expect(sent).toEqual([{ notes: "Первая\nВторая" }]));
  });

  it("restores the value and sends nothing on Escape, without closing the panel", async () => {
    const state = catalogue();
    const sent = capturePatch(state);
    const onClose = vi.fn();
    setup({ onClose });

    await userEvent.click(await screen.findByRole("button", { name: "Сайт" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Сайт" }), "/new{Escape}");

    expect(screen.getByRole("button", { name: "Сайт" })).toHaveTextContent("https://example.com");
    expect(sent).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps an invalid amount open with the reason and stores nothing", async () => {
    const state = catalogue();
    const sent = capturePatch(state);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Сумма сделки" }));
    const input = screen.getByRole("textbox", { name: "Сумма сделки" });
    await userEvent.clear(input);
    await userEvent.type(input, "abc{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Введите сумму числом");
    expect(screen.getByRole("textbox", { name: "Сумма сделки" })).toHaveValue("abc");
    expect(sent).toEqual([]);
  });

  it("restores the stored value and raises the error when the API refuses", async () => {
    catalogue();
    server.use(mock.patch(`${BOARD}/leads/lead-1`, () => HttpResponse.json({ error: { message: "Email is invalid" } }, { status: 400 })));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Email" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "nope@example.com{Enter}");

    expect(await screen.findByText("Email is invalid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Email" })).toHaveTextContent("Пусто");
  });

  it("renames the lead and refuses a blank name", async () => {
    const state = catalogue();
    const sent = capturePatch(state);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Имя лида" }));
    const input = screen.getByRole("textbox", { name: "Имя лида" });
    await userEvent.clear(input);
    await userEvent.type(input, "{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Введите имя");
    expect(sent).toEqual([]);

    await userEvent.type(input, "Леонид Петров{Enter}");
    await waitFor(() => expect(sent).toEqual([{ name: "Леонид Петров" }]));
  });

  it("assigns an employee of the board's client", async () => {
    const state = catalogue();
    const sent = capturePatch(state);
    setup();

    await waitFor(() => expect(screen.getByLabelText("Ответственный")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Ответственный"));
    await userEvent.click(await screen.findByRole("option", { name: /Женя Радюк/ }));

    await waitFor(() => expect(sent).toEqual([{ assigneeId: "member-1" }]));
  });

  it("adds a tag suggested from the board and removes one", async () => {
    const state = catalogue(theLead(), { others: [aLead({ id: "other", tags: ["Срочно"] })] });
    const sent = capturePatch(state);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Добавить метку" }));
    await userEvent.type(screen.getByLabelText("Новая метка"), "Сро");
    const suggestions = await screen.findByRole("listbox", { name: "Метки доски" });
    await userEvent.click(within(suggestions).getByRole("option", { name: "Срочно" }));
    await waitFor(() => expect(sent).toEqual([{ tags: ["VIP", "Срочно"] }]));

    await userEvent.click(await screen.findByRole("button", { name: "Убрать метку VIP" }));
    await waitFor(() => expect(sent[1]).toEqual({ tags: ["Срочно"] }));
  });

  it("moves the lead to the end of the stage picked in the header", async () => {
    catalogue();
    let moved: unknown = null;
    server.use(mock.patch(`${BOARD}/leads/lead-1/move`, async ({ request }) => {
      moved = await request.json();
      return HttpResponse.json([theLead({ stage: "PROPOSAL" })]);
    }));
    setup();

    await userEvent.click(await screen.findByLabelText("Этап"));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Новый", "Квалифицированный", "Целевой", "КП", "Встреча"]);
    await userEvent.click(screen.getByRole("option", { name: "КП" }));

    await waitFor(() => expect(moved).toEqual({ stage: "PROPOSAL", position: 2147483647 }));
  });

  it("deletes the lead only once confirmed and says so", async () => {
    catalogue();
    let deleted = false;
    server.use(mock.delete(`${BOARD}/leads/lead-1`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
    const onClose = vi.fn();
    setup({ onClose });

    await userEvent.click(await screen.findByRole("button", { name: "Действия лида" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Удалить" }));
    expect(deleted).toBe(false);
    await userEvent.click(await screen.findByRole("button", { name: "Удалить лид" }));

    await waitFor(() => expect(deleted).toBe(true));
    expect(await screen.findByText("Лид удалён")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("custom values in the panel", () => {
  it("stores each value as it is entered", async () => {
    const state = catalogue(theLead({ customValues: { meeting: "2026-11-12" } }));
    const sent = capturePatch(state);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Бюджет" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Бюджет" }), "-2 500,5{Enter}");
    await waitFor(() => expect(sent).toEqual([{ customValues: { budget: "-2500.5" } }]));

    await userEvent.click(screen.getByLabelText("Встреча"));
    const calendar = await screen.findByRole("dialog", { name: "Выбрать дату" });
    await userEvent.click(within(calendar).getByRole("button", { name: /20 ноября/ }));
    await waitFor(() => expect(sent[1]).toEqual({ customValues: { meeting: "2026-11-20" } }));

    await userEvent.click(screen.getByLabelText("Сегмент"));
    await userEvent.click(await screen.findByRole("option", { name: "Розница" }));
    await waitFor(() => expect(sent[2]).toEqual({ customValues: { segment: "o2" } }));

    await userEvent.click(screen.getByLabelText("Квалифицирован"));
    await waitFor(() => expect(sent[3]).toEqual({ customValues: { qualified: true } }));
  });

  it("keeps an invalid number open with the reason", async () => {
    const state = catalogue();
    const sent = capturePatch(state);
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Бюджет" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Бюджет" }), "abc{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("Введите число, не больше 4 знаков после запятой");
    expect(sent).toEqual([]);
  });
});

describe("a read-only member", () => {
  it("sees every value, opens links in a new tab and edits nothing", async () => {
    catalogue(theLead({ customValues: { brief: "https://example.com/brief", segment: "o1" } }));
    setup({ capabilities: readOnly });

    await screen.findByRole("complementary", { name: "Леонид" });
    await within(panel()).findByLabelText("Бриф");
    expect(screen.getByLabelText("Номер телефона")).toHaveTextContent("+375290000000");
    expect(screen.queryByRole("button", { name: "Номер телефона" })).toBeNull();
    const link = within(panel()).getAllByRole("link", { name: "Открыть ссылку" }).find((anchor) => anchor.getAttribute("href") === "https://example.com/brief")!;
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(within(panel()).getByText("Опт")).toHaveAttribute("data-color", "blue");
    expect(screen.queryByRole("button", { name: "Действия лида" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Этап" })).toBeNull();
  });
});

describe("the activity tab", () => {
  it("tells what happened, newest first, including custom fields", async () => {
    catalogue();
    server.use(mock.get(`${BOARD}/leads/lead-1/activity`, () => HttpResponse.json([
      { id: "e3", kind: "changed", actor: { name: "Мария" }, at: "2026-11-07T10:00:00.000Z", changes: [
        { field: "custom", fieldId: "segment", name: "Сегмент", type: "SELECT", before: ["Опт"], after: ["Розница"] },
        { field: "custom", fieldId: "qualified", name: "Квалифицирован", type: "CHECKBOX", before: false, after: true },
        { field: "custom", fieldId: "meeting", name: "Встреча", type: "DATE", before: null, after: "2026-11-12" },
        { field: "custom", fieldId: "channels", name: "Каналы", type: "MULTI_SELECT", before: ["Сайт", null], after: ["Сайт"] },
      ] },
      { id: "e2", kind: "moved", actor: { name: "Мария" }, at: "2026-09-11T10:00:00.000Z", stage: { from: "Новый", to: "КП" } },
      { id: "e1", kind: "created", actor: { name: "Женя Радюк" }, at: "2026-09-10T10:00:00.000Z" },
    ])));
    setup();

    await userEvent.click(await screen.findByRole("radio", { name: "Активность" }));
    const feed = await screen.findByRole("list", { name: "Активность" });
    const entries = within(feed).getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent("Сегмент: Опт → Розница");
    expect(entries[0]).toHaveTextContent("Квалифицирован: Нет → Да");
    expect(entries[0]).toHaveTextContent("Встреча: — → 12.11.2026");
    expect(entries[0]).toHaveTextContent("Каналы: Сайт, удалённый вариант → Сайт");
    expect(entries[1]).toHaveTextContent("Этап: Новый → КП");
    expect(entries[2]).toHaveTextContent("Лид создан");
  });
});

describe("the files tab", () => {
  const contract = { id: "file-1", leadId: "lead-1", name: "Договор.pdf", contentType: "application/pdf", bytes: 2048, uploader: { id: "member-1", name: "Женя Радюк" }, createdAt: "2026-09-12T10:00:00.000Z" };

  it("lists files and lets a guest download but not attach or remove", async () => {
    catalogue();
    server.use(mock.get(`${BOARD}/leads/lead-1/files`, () => HttpResponse.json([contract])));
    setup({ capabilities: readOnly });

    await userEvent.click(await screen.findByRole("radio", { name: "Файлы" }));
    const row = within(await screen.findByRole("list", { name: "Файлы" })).getByRole("listitem");
    expect(row).toHaveTextContent("Договор.pdf");
    expect(row).toHaveTextContent("2 КБ");
    expect(within(row).getByRole("button", { name: "Скачать Договор.pdf" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Прикрепить файл")).toBeNull();
    expect(screen.queryByRole("button", { name: "Удалить Договор.pdf" })).toBeNull();
  });

  it("attaches a file", async () => {
    catalogue();
    let uploaded = false;
    server.use(mock.post(`${BOARD}/leads/lead-1/files`, () => { uploaded = true; return HttpResponse.json(contract, { status: 201 }); }));
    setup();

    await userEvent.click(await screen.findByRole("radio", { name: "Файлы" }));
    await userEvent.upload(screen.getByLabelText("Прикрепить файл"), new File(["pdf"], "Договор.pdf", { type: "application/pdf" }));

    await waitFor(() => expect(uploaded).toBe(true));
  });
});
