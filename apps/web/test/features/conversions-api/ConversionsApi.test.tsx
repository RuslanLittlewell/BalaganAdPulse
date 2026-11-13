import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { MetaIntegration } from "@/features/meta-integration/index.js";

const integrations = "/api/projects/p1/integrations";
const summaryPath = "/api/projects/p1/conversions-api";
const eventsPath = "/api/crm/boards/p1/conversion-events";
const meta = { id: "i1", provider: "META", accountId: "123", currency: "BYN", timezone: "Europe/Minsk", status: "SUCCESS", lastSuccessAt: null, lastError: null, nextDailyAt: "2026-11-14T06:00:00Z", leadsEnabled: true, leads: { status: "OK", lastSuccessAt: null, lastError: null } };
const google = { ...meta, id: "g1", provider: "GOOGLE" };
const dataset = { datasetId: "1234567890", datasetName: "Пиксель клиента", testEventCode: null, currency: "BYN", state: "ACTIVE", lastError: null, lastSentAt: "2026-11-13T09:00:00Z" };
const empty = { dataset: null, counts: { today: 0, week: 0, month: 0 }, recent: [] };
const connected = { dataset, counts: { today: 3, week: 12, month: 40 }, recent: [] };

const panel = () => screen.findByRole("region", { name: "Conversions API" });

describe("the Conversions API panel", () => {
  it("appears beside a Meta connection and not for a project connected only to Google", async () => {
    server.use(http.get(integrations, () => HttpResponse.json([google])));
    const { unmount } = renderWithProviders(<MetaIntegration projectId="p1" />);
    await screen.findByRole("region", { name: "Google Ads" });
    expect(screen.queryByRole("region", { name: "Conversions API" })).not.toBeInTheDocument();
    unmount();

    server.use(http.get(integrations, () => HttpResponse.json([meta])));
    renderWithProviders(<MetaIntegration projectId="p1" />);
    expect(await panel()).toBeInTheDocument();
    expect(await screen.findByText("Набор данных не подключён: этапы CRM не передаются в Meta.")).toBeInTheDocument();
  });

  it("is not shown to a guest", async () => {
    let reads = 0;
    server.use(
      http.get("/api/auth/me", () => HttpResponse.json({ user: { id: "u", name: "Guest", email: "g@example.com" }, organization: { id: "o", name: "O", slug: "o" }, role: "GUEST", clientIds: [], modules: ["DASHBOARD", "PROJECTS", "CRM"] })),
      http.get(integrations, () => HttpResponse.json([meta])),
      http.get(summaryPath, () => { reads++; return HttpResponse.json(empty); }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Добавить интеграцию" })).toBeNull());
    expect(screen.queryByRole("region", { name: "Conversions API" })).toBeNull();
    expect(reads).toBe(0);
  });

  it("connects a dataset, clears the token and shows the counts and the test mode notice", async () => {
    let sent: unknown;
    server.use(
      http.get(integrations, () => HttpResponse.json([meta])),
      http.get(summaryPath, () => HttpResponse.json(sent ? { ...connected, dataset: { ...dataset, testEventCode: "TEST123" } } : empty)),
      http.put(summaryPath, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...connected, dataset: { ...dataset, testEventCode: "TEST123" } });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Подключить" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("ID набора данных"), "1234567890");
    const token = within(dialog).getByLabelText("Маркер доступа Conversions API");
    expect(token).toHaveAttribute("type", "password");
    await userEvent.type(token, "synthetic-capi-secret");
    await userEvent.type(within(dialog).getByLabelText("Код тестовых событий"), "TEST123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Подключить" }));

    await waitFor(() => expect(sent).toEqual({ datasetId: "1234567890", token: "synthetic-capi-secret", testEventCode: "TEST123" }));
    await waitFor(() => expect(within(dialog).getByLabelText("Новый маркер доступа (необязательно)")).toHaveValue(""));
    expect(within(dialog).getByText("В Meta: Пиксель клиента")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    const counts = within(await panel()).getByLabelText("Отправлено событий");
    expect(within(counts).getAllByRole("term").map((term) => term.textContent)).toEqual(["Сегодня", "7 дней", "30 дней"]);
    expect(within(counts).getAllByRole("definition").map((value) => value.textContent)).toEqual(["3", "12", "40"]);
    expect(within(await panel()).getByText(/Задан код тестовых событий/)).toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain("synthetic-capi-secret");
  });

  it("shows a Russian error without the provider's text when Meta refuses the token", async () => {
    server.use(
      http.get(integrations, () => HttpResponse.json([meta])),
      http.put(summaryPath, () => HttpResponse.json({ error: { message: "raw-provider-text", details: [{ code: "TOKEN" }] } }, { status: 400 })),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Подключить" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("ID набора данных"), "1234567890");
    await userEvent.type(within(dialog).getByLabelText("Маркер доступа Conversions API"), "bad-token");
    await userEvent.click(within(dialog).getByRole("button", { name: "Подключить" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Meta не приняла ID набора данных или маркер доступа. Проверьте их и повторите.");
    expect(screen.queryByText("raw-provider-text")).not.toBeInTheDocument();
  });

  it("says a new token is needed when Meta stopped accepting it", async () => {
    server.use(
      http.get(integrations, () => HttpResponse.json([meta])),
      http.get(summaryPath, () => HttpResponse.json({ ...connected, dataset: { ...dataset, state: "AUTH_REQUIRED", lastError: "Error validating access token" } })),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />);
    expect(await within(await panel()).findByRole("alert")).toHaveTextContent("Meta не принимает маркер доступа. Вставьте новый маркер, и отправка продолжится.");
  });

  it("creates an event from the board's stages and edits another", async () => {
    let created: unknown;
    let edited: unknown;
    server.use(
      http.get(integrations, () => HttpResponse.json([meta])),
      http.get(summaryPath, () => HttpResponse.json(connected)),
      http.get(eventsPath, () => HttpResponse.json([{ id: "e1", projectId: "p1", name: "Квал", stages: ["QUALIFIED"], carriesAmount: false }])),
      http.post(eventsPath, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({ id: "e2", projectId: "p1", ...(created as object) }, { status: 201 });
      }),
      http.patch(`${eventsPath}/e1`, async ({ request }) => {
        edited = await request.json();
        return HttpResponse.json({ id: "e1", projectId: "p1", ...(edited as object) });
      }),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Настроить" }));
    const events = await screen.findByRole("region", { name: "События" });
    const qual = await within(events).findByRole("listitem", { name: "Квал" });
    expect(qual).toHaveTextContent("Квалифицированный");

    await userEvent.click(within(events).getByRole("button", { name: "Добавить событие" }));
    const editor = within(events).getByRole("form", { name: "Название события" });
    await userEvent.type(within(editor).getByLabelText("Название события"), "Продажа");
    await userEvent.click(within(editor).getByRole("checkbox", { name: "КП" }));
    await userEvent.click(within(editor).getByRole("checkbox", { name: "С суммой" }));
    await userEvent.click(within(editor).getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(created).toEqual({ name: "Продажа", stages: ["PROPOSAL"], carriesAmount: true }));
    expect(await within(events).findByRole("listitem", { name: "Продажа" })).toHaveTextContent("КП");

    await userEvent.click(within(within(events).getByRole("listitem", { name: "Квал" })).getByRole("button", { name: "Изменить" }));
    const form = within(events).getByRole("form", { name: "Название события" });
    await userEvent.click(within(form).getByRole("checkbox", { name: "Целевой" }));
    await userEvent.click(within(form).getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(edited).toEqual({ name: "Квал", stages: ["QUALIFIED", "TARGET"], carriesAmount: false }));
  });

  it("marks an event left without stages and explains a duplicate name", async () => {
    server.use(
      http.get(integrations, () => HttpResponse.json([meta])),
      http.get(summaryPath, () => HttpResponse.json(connected)),
      http.get(eventsPath, () => HttpResponse.json([{ id: "e1", projectId: "p1", name: "Замер", stages: [], carriesAmount: false }])),
      http.post(eventsPath, () => HttpResponse.json({ error: { message: "An event with that name already exists in this project" } }, { status: 409 })),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Настроить" }));
    const events = await screen.findByRole("region", { name: "События" });
    expect(await within(events).findByRole("listitem", { name: "Замер" })).toHaveTextContent("Нет этапов");

    await userEvent.click(within(events).getByRole("button", { name: "Добавить событие" }));
    const editor = within(events).getByRole("form", { name: "Название события" });
    await userEvent.type(within(editor).getByLabelText("Название события"), "замер");
    await userEvent.click(within(editor).getByRole("checkbox", { name: "Целевой" }));
    await userEvent.click(within(editor).getByRole("button", { name: "Сохранить" }));
    expect(await within(editor).findByRole("alert")).toHaveTextContent("Событие с таким названием уже есть.");
  });

  it("lists the latest events with their states and the reason a refused one was not sent", async () => {
    server.use(
      http.get(integrations, () => HttpResponse.json([meta])),
      http.get(summaryPath, () => HttpResponse.json({ ...connected, recent: [
        { id: "s1", leadId: "l1", leadName: "Анна", eventName: "Квал", reachedAt: "2026-11-13T09:00:00Z", status: "SENT", lastError: null, sentAt: "2026-11-13T09:01:00Z" },
        { id: "s2", leadId: "l2", leadName: "Борис", eventName: "Продажа", reachedAt: "2026-11-13T08:00:00Z", status: "WAITING_AMOUNT", lastError: null, sentAt: null },
        { id: "s3", leadId: "l3", leadName: "Вера", eventName: "Квал", reachedAt: "2026-11-12T08:00:00Z", status: "FAILED", lastError: "Неверное значение event_time", sentAt: null },
        { id: "s4", leadId: "l4", leadName: "Глеб", eventName: "Квал", reachedAt: "2026-11-01T08:00:00Z", status: "EXPIRED", lastError: "Older than the seven days Meta accepts", sentAt: null },
        { id: "s5", leadId: "l5", leadName: "Дина", eventName: "Замер", reachedAt: "2026-11-13T07:00:00Z", status: "PENDING", lastError: null, sentAt: null },
      ] })),
    );
    renderWithProviders(<MetaIntegration projectId="p1" />);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Журнал" }));
    const dialog = await screen.findByRole("dialog", { name: "Последние события" });
    const rows = within(dialog).getAllByRole("row").slice(1);
    expect(rows.map((row) => [row.getAttribute("data-status"), within(row).getAllByRole("cell")[0]!.textContent])).toEqual([
      ["SENT", "Анна"], ["WAITING_AMOUNT", "Борис"], ["FAILED", "Вера"], ["EXPIRED", "Глеб"], ["PENDING", "Дина"],
    ]);
    expect(rows.map((row) => within(row).getAllByRole("cell")[3]!.textContent)).toEqual([
      "Отправлено", "Ждёт сумму", "Не отправленоНеверное значение event_time", "Устарело", "В очереди",
    ]);
  });
});
