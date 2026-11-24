import { http as mock, HttpResponse, type JsonBodyType } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { IntegrationsButton } from "@/widgets/crm-nav/index.js";

const capabilities = { create: true, update: true, delete: true };
const BOARD = { key: "project-1", label: "Сайт", clientId: "client-1", clientName: "Ромашка", capabilities };
const CONNECTED = {
  portalHost: "acme.bitrix24.ru",
  status: "ACTIVE",
  enabled: true,
  inboundProjectId: null,
  connectedAt: "2026-11-20T10:00:00.000Z",
  lastSyncAt: "2026-11-20T10:05:00.000Z",
  lastError: null,
  webhookUrl: "https://app.balagan.pro/api/integrations/bitrix24/KEY123",
};

function serve({ role = "ADMIN", boards = [BOARD], connection = null }: { role?: string; boards?: JsonBodyType[]; connection?: Record<string, JsonBodyType> | null } = {}) {
  let stored: Record<string, JsonBodyType> | null = connection;
  const sent: Array<{ method: string; path: string; body?: unknown }> = [];
  server.use(
    mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role,
      clientIds: [],
    })),
    mock.get("/api/crm/boards", () => HttpResponse.json(boards)),
    mock.get("/api/projects/project-1/website-key", () => HttpResponse.json(null)),
    mock.get("/api/bitrix24/connection", () => HttpResponse.json(stored)),
    mock.post("/api/bitrix24/connection", async ({ request }) => {
      const body = await request.json() as Record<string, string>;
      sent.push({ method: "POST", path: "connection", body });
      if (body.webhookUrl.includes("bad")) {
        return HttpResponse.json({ error: { message: "Bitrix24 rejected the webhook address" } }, { status: 400 });
      }
      stored = CONNECTED;
      return HttpResponse.json(CONNECTED, { status: 201 });
    }),
    mock.patch("/api/bitrix24/connection", async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      sent.push({ method: "PATCH", path: "connection", body });
      stored = { ...stored, ...(body as Record<string, JsonBodyType>) };
      return HttpResponse.json(stored);
    }),
    mock.delete("/api/bitrix24/connection", () => {
      sent.push({ method: "DELETE", path: "connection" });
      stored = null;
      return new HttpResponse(null, { status: 204 });
    }),
    mock.get("/api/bitrix24/statuses", () => HttpResponse.json([{ id: "NEW", name: "Не обработан" }, { id: "IN_PROCESS", name: "В работе" }])),
    mock.get("/api/bitrix24/stages", () => HttpResponse.json([
      { key: "NEW", name: "Новый", projectId: null, projectName: null, statusId: "NEW" },
      { key: "TARGET", name: "Целевой", projectId: null, projectName: null, statusId: null },
    ])),
    mock.put("/api/bitrix24/stages", async ({ request }) => {
      const body = await request.json();
      sent.push({ method: "PUT", path: "stages", body });
      return HttpResponse.json([]);
    }),
    mock.get("/api/bitrix24/problems", () => HttpResponse.json([
      { kind: "LEAD", key: "remote:42", reason: "NO_INBOUND_PROJECT", label: null, createdAt: "2026-11-20T10:00:00.000Z" },
      { kind: "LEAD", key: "lead-1", reason: "REFUSED: TITLE is too long", label: "Анна", createdAt: "2026-11-20T10:00:00.000Z" },
    ])),
    mock.get("/api/bitrix24/runs/latest", () => HttpResponse.json(null)),
    mock.post("/api/bitrix24/runs", async ({ request }) => {
      const body = await request.json();
      sent.push({ method: "POST", path: "runs", body });
      return HttpResponse.json({ id: "run-1", direction: "UPLOAD", state: "RUNNING", created: 0, linked: 0, failed: 0, startedAt: "2026-11-20T10:00:00.000Z", finishedAt: null }, { status: 202 });
    }),
  );
  return sent;
}

const open = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Интеграции +" }));
  return screen.findByRole("dialog", { name: "Интеграции" });
};

const openBitrix = async () => {
  const dialog = await open();
  await userEvent.click(within(dialog).getByRole("radio", { name: "Битрикс24" }));
  return dialog;
};

describe("the integrations dialog", () => {
  it("opens on the web integration for an admin, with the Bitrix24 tab beside it", async () => {
    serve();
    renderWithProviders(<IntegrationsButton />);

    const dialog = await open();

    expect(within(dialog).getByRole("radiogroup", { name: "Интеграции" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Web интеграция" })).toHaveAttribute("aria-checked", "true");
    expect(await within(dialog).findByRole("button", { name: "Создать ключ" })).toBeInTheDocument();
  });

  it("asks to choose a project for the web integration while there is no board, and still offers Bitrix24", async () => {
    serve({ boards: [] });
    renderWithProviders(<IntegrationsButton />);

    const dialog = await open();
    expect(within(dialog).getByText("Выберите проект в CRM, чтобы настроить для него сайт.")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("radio", { name: "Битрикс24" }));
    expect(await within(dialog).findByLabelText("Адрес входящего вебхука")).toBeInTheDocument();
  });

  it("is not offered to a guest", async () => {
    serve({ role: "GUEST" });
    renderWithProviders(<IntegrationsButton />);

    await waitFor(() => expect(screen.queryByRole("button", { name: "Интеграции +" })).not.toBeInTheDocument());
  });
});

describe("the Bitrix24 tab", () => {
  it("connects a portal and shows the address the portal must call", async () => {
    const sent = serve();
    renderWithProviders(<IntegrationsButton />);
    const dialog = await openBitrix();

    await userEvent.type(await within(dialog).findByLabelText("Адрес входящего вебхука"), "https://acme.bitrix24.ru/rest/1/abc/");
    await userEvent.type(within(dialog).getByLabelText("Токен исходящего вебхука"), "app-token");
    await userEvent.click(within(dialog).getByRole("button", { name: "Подключить" }));

    expect(await within(dialog).findByText(CONNECTED.webhookUrl)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Скопировать адрес" })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("status")[0]).toHaveAttribute("data-status", "ACTIVE");
    expect(sent).toEqual([{ method: "POST", path: "connection", body: { webhookUrl: "https://acme.bitrix24.ru/rest/1/abc/", applicationToken: "app-token" } }]);
  });

  it("keeps the browser and password managers from filling the connection fields", async () => {
    serve();
    renderWithProviders(<IntegrationsButton />);
    const dialog = await openBitrix();

    const address = await within(dialog).findByLabelText("Адрес входящего вебхука");
    const token = within(dialog).getByLabelText("Токен исходящего вебхука");
    for (const field of [address, token]) {
      expect(field).toHaveAttribute("autocomplete", "off");
      expect(field).toHaveAttribute("data-1p-ignore", "true");
      expect(field).toHaveAttribute("data-lpignore", "true");
    }
    expect(token).not.toHaveAttribute("type", "password");
    expect(address.closest("form")).toHaveAttribute("autocomplete", "off");
  });

  it("keeps what was typed and says so when the portal rejects the address", async () => {
    serve();
    renderWithProviders(<IntegrationsButton />);
    const dialog = await openBitrix();

    await userEvent.type(await within(dialog).findByLabelText("Адрес входящего вебхука"), "https://bad.bitrix24.ru/rest/1/abc/");
    await userEvent.type(within(dialog).getByLabelText("Токен исходящего вебхука"), "app-token");
    await userEvent.click(within(dialog).getByRole("button", { name: "Подключить" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Битрикс24 не принял адрес");
    expect(within(dialog).getByLabelText("Адрес входящего вебхука")).toHaveValue("https://bad.bitrix24.ru/rest/1/abc/");
  });

  it("maps stages to statuses and lists what was skipped or refused", async () => {
    const sent = serve({ connection: CONNECTED });
    renderWithProviders(<IntegrationsButton />);
    const dialog = await openBitrix();

    await userEvent.click(await within(dialog).findByRole("combobox", { name: "Целевой" }));
    await userEvent.click(await screen.findByRole("option", { name: "В работе" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить сопоставление" }));

    await waitFor(() => expect(sent).toContainEqual({
      method: "PUT", path: "stages", body: { links: [{ stageKey: "NEW", statusId: "NEW" }, { stageKey: "TARGET", statusId: "IN_PROCESS" }] },
    }));
    const problems = within(dialog).getByRole("list", { name: "Пропущено и не отправлено" });
    expect(within(problems).getByText("Лид «запись Битрикс24 №42»: не выбран проект для лидов из Битрикс24")).toBeInTheDocument();
    expect(within(problems).getByText("Лид «Анна»: Битрикс24 отказал: TITLE is too long")).toBeInTheDocument();
  });

  it("chooses the project for leads from Bitrix24", async () => {
    const sent = serve({ connection: CONNECTED });
    renderWithProviders(<IntegrationsButton />);
    const dialog = await openBitrix();

    await userEvent.click(await within(dialog).findByRole("combobox", { name: "Проект для лидов из Битрикс24" }));
    await userEvent.click(await screen.findByRole("option", { name: "Сайт · Ромашка" }));

    await waitFor(() => expect(sent).toContainEqual({ method: "PATCH", path: "connection", body: { inboundProjectId: "project-1" } }));
  });

  it("asks before disconnecting and changes nothing until confirmed", async () => {
    const sent = serve({ connection: CONNECTED });
    renderWithProviders(<IntegrationsButton />);
    const dialog = await openBitrix();

    await userEvent.click(await within(dialog).findByRole("button", { name: "Отключить портал" }));
    const confirmation = within(dialog).getByRole("group", { name: "Отключить портал" });
    expect(confirmation).toHaveTextContent("связи между записями забудутся");
    expect(sent.filter((entry) => entry.method === "DELETE")).toEqual([]);

    await userEvent.click(within(confirmation).getByRole("button", { name: "Отключить" }));

    expect(await within(dialog).findByLabelText("Адрес входящего вебхука")).toBeInTheDocument();
    expect(sent).toContainEqual({ method: "DELETE", path: "connection" });
  });

  it("says matching records are linked, not duplicated, before moving existing records", async () => {
    const sent = serve({ connection: CONNECTED });
    renderWithProviders(<IntegrationsButton />);
    const dialog = await openBitrix();

    await userEvent.click(await within(dialog).findByRole("button", { name: "Выгрузить в Битрикс24" }));
    const confirmation = within(dialog).getByRole("group", { name: "Выгрузить в Битрикс24" });
    expect(confirmation).toHaveTextContent("связывается по телефону, email или названию");
    expect(confirmation).not.toHaveTextContent("Дубликаты не ищутся");
    await userEvent.click(within(confirmation).getByRole("button", { name: "Перенести" }));

    await waitFor(() => expect(sent).toContainEqual({ method: "POST", path: "runs", body: { direction: "UPLOAD" } }));
    expect(await within(dialog).findByText("Перенос идёт. Создано: 0, связано: 0, ошибок: 0")).toBeInTheDocument();
  });

  it("says the webhook was rejected when the connection needs a new address", async () => {
    serve({ connection: { ...CONNECTED, status: "AUTH_REQUIRED", lastError: "AUTH" } });
    renderWithProviders(<IntegrationsButton />);
    const dialog = await openBitrix();

    expect(await within(dialog).findByText(/Битрикс24 отклонил вебхук/)).toHaveAttribute("data-status", "AUTH_REQUIRED");
  });
});
