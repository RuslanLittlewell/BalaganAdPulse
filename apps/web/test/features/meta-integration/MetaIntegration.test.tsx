import { http, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { MetaIntegration } from "@/features/meta-integration/index.js";
const path = "/api/projects/p1/integrations/meta";
const connected = { accountId: "123", currency: "BYN", timezone: "UTC", status: "SUCCESS", lastSuccessAt: "2026-09-08T06:00:00Z", lastError: null, nextDailyAt: "2026-09-09T06:00:00Z" };
it("accepts Account ID and token on the frontend, sends them to the server and clears the secret", async () => {
  let sent: unknown;
  server.use(http.get(path, () => HttpResponse.json(null)), http.put(path, async ({ request }) => { sent = await request.json(); return HttpResponse.json({ ...connected, status: "QUEUED" }); }));
  renderWithProviders(<MetaIntegration projectId="p1" />);
  await userEvent.click(await screen.findByRole("button", { name: "Meta API" }));
  await userEvent.type(screen.getByLabelText("Account ID"), "act_123");
  const token = screen.getByLabelText("Токен доступа");
  expect(token).toHaveAttribute("type", "password");
  await userEvent.type(token, "synthetic-secret");
  await userEvent.click(screen.getByRole("button", { name: "Подключить" }));
  await waitFor(() => expect(sent).toEqual({ accountId: "act_123", token: "synthetic-secret" }));
  await waitFor(() => expect(screen.queryByLabelText("Токен доступа")).not.toBeInTheDocument());
  expect(JSON.stringify(localStorage)).not.toContain("synthetic-secret");
});
it("refreshes manually, displays success and disconnects while leaving dashboard data alone", async () => {
  let refreshes = 0;
  let removed = false;
  server.use(http.get(path, () => HttpResponse.json(connected)), http.post(`${path}/sync`, () => { refreshes++; return HttpResponse.json({ ...connected, status: "QUEUED" }); }), http.delete(path, () => { removed = true; return new HttpResponse(null, { status: 204 }); }));
  renderWithProviders(<MetaIntegration projectId="p1" />);
  await userEvent.click(await screen.findByRole("button", { name: "Обновить" }));
  expect(refreshes).toBe(1);
  const refresh = await screen.findByRole("button", { name: "Обновить" });
  await waitFor(() => expect(refresh).toHaveAttribute("aria-busy", "true"));
  expect(refresh).toBeDisabled();
  await userEvent.click(refresh);
  expect(refreshes).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "Meta API" }));
  expect(screen.getByLabelText("Account ID")).toHaveValue("123");
  expect(screen.getByLabelText("Токен доступа")).toHaveValue("");
  await userEvent.click(screen.getByRole("button", { name: "Отключить" }));
  await waitFor(() => expect(removed).toBe(true));
});
it("shows Russian errors without echoing provider text and permits token replacement", async () => {
  server.use(http.get(path, () => HttpResponse.json({ ...connected, status: "AUTH_REQUIRED", lastError: "TOKEN" })), http.put(path, () => HttpResponse.json({ error: { message: "raw-secret", details: [{ code: "TOKEN" }] } }, { status: 400 })));
  renderWithProviders(<MetaIntegration projectId="p1" />);
  expect(await screen.findByText("Токен недействителен или истёк. Вставьте новый токен." )).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Meta API" }));
  await userEvent.type(screen.getByLabelText("Токен доступа"), "replacement");
  await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  expect(screen.queryByText("raw-secret")).not.toBeInTheDocument();
});
it("does not fetch or show connection settings for guests", async () => {
  let reads = 0;
  server.use(http.get("/api/auth/me", () => HttpResponse.json({ user: { id: "u", name: "Guest", email: "g@example.com" }, organization: { id: "o", name: "O", slug: "o" }, role: "GUEST", clientIds: [] })), http.get(path, () => { reads++; return HttpResponse.json(connected); }));
  renderWithProviders(<MetaIntegration projectId="p1" />);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Meta API" })).not.toBeInTheDocument());
  expect(reads).toBe(0);
});
it("polls a queued import and refreshes the displayed project summary on completion", async () => {
  let running = false;
  let summaryReads = 0;
  server.use(
    http.get(path, () => HttpResponse.json({ ...connected, lastSuccessAt: running ? "2026-09-09T06:00:00Z" : connected.lastSuccessAt })),
    http.post(`${path}/sync`, () => { running = true; return HttpResponse.json({ ...connected, status: "QUEUED" }); }),
    http.get("/api/projects/p1/summary", () => { summaryReads++; return HttpResponse.json({ spend: running ? "12.3456" : "0.0000" }); }),
  );
  const { useQuery } = await import("@tanstack/react-query");
  const { http: api } = await import("@/shared/lib/index.js");
  function Dashboard() {
    const summary = useQuery({ queryKey: ["projects", "p1", "summary"], queryFn: () => api.get<{ spend: string }>("/projects/p1/summary") });
    return <><MetaIntegration projectId="p1" /><span>{summary.data?.spend}</span></>;
  }
  renderWithProviders(<Dashboard />);
  await screen.findByText("0.0000");
  await userEvent.click(await screen.findByRole("button", { name: "Обновить" }));
  await screen.findByText("12.3456", {}, { timeout: 5000 });
  expect(summaryReads).toBeGreaterThan(1);
});

describe("the Meta panel at rest", () => {
  const withLeads = (leads: unknown, overrides: Record<string, unknown> = {}) =>
    server.use(http.get(path, () => HttpResponse.json({ ...connected, ...overrides, leads })));

  it("shows its heading and only when advertising was last imported and when leads were last checked", async () => {
    withLeads({ status: "OK", lastSuccessAt: "2026-09-13T09:50:00Z", lastError: null });
    renderWithProviders(<MetaIntegration projectId="p1" />);

    const panel = await screen.findByRole("region", { name: "Meta · Facebook Ads" });
    expect(await within(panel).findByText(/^Проверка лидов:/)).toBeInTheDocument();
    expect(within(panel).getByText(/^Обновление:/)).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Meta · Facebook Ads" })).toBeInTheDocument();
    expect(within(panel).queryByText("Автообновление каждый день в 08:00")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("status")).not.toBeInTheDocument();
    expect(within(panel).queryByText(/Данные обновлены|BYN|Лиды из форм|загружаются/)).not.toBeInTheDocument();
    expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says nothing about leads before the first lead check", async () => {
    withLeads({ status: "WAITING", lastSuccessAt: null, lastError: null });
    renderWithProviders(<MetaIntegration projectId="p1" />);

    const panel = await screen.findByRole("region", { name: "Meta · Facebook Ads" });
    expect(await within(panel).findByText(/^Обновление:/)).toBeInTheDocument();
    expect(within(panel).queryByText(/лид/i)).not.toBeInTheDocument();
  });

  it("explains which access leads need while it applies, without asking for a new token", async () => {
    withLeads({ status: "ACCESS_REQUIRED", lastSuccessAt: null, lastError: "ACCESS" });
    renderWithProviders(<MetaIntegration projectId="p1" />);

    const guidance = await screen.findByRole("alert");
    expect(guidance).toHaveTextContent("leads_retrieval");
    expect(guidance).toHaveTextContent("Leads Access Manager");
    expect(screen.queryByText(/Лиды из форм|нет доступа$/)).not.toBeInTheDocument();
    expect(screen.queryByText("Токен недействителен или истёк. Вставьте новый токен.")).not.toBeInTheDocument();
  });

  it("explains a failed lead check next to the time of the last good one", async () => {
    withLeads({ status: "ERROR", lastSuccessAt: "2026-09-13T09:00:00Z", lastError: "PROVIDER" });
    renderWithProviders(<MetaIntegration projectId="p1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить лиды из Meta. Повторим при следующей проверке.");
    expect(screen.getByText(/^Проверка лидов:/)).toBeInTheDocument();
    expect(screen.queryByText(/Лиды из форм/)).not.toBeInTheDocument();
  });

  it("still asks for a new token when the advertising import was refused", async () => {
    withLeads({ status: "OK", lastSuccessAt: "2026-09-13T09:50:00Z", lastError: "TOKEN" }, { status: "AUTH_REQUIRED", lastError: "TOKEN" });
    renderWithProviders(<MetaIntegration projectId="p1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Токен недействителен или истёк. Вставьте новый токен.");
    expect(screen.queryByText("Нужен новый токен")).not.toBeInTheDocument();
  });
});

it("keeps the Meta panel from a client who may edit the project", async () => {
  let reads = 0;
  server.use(
    http.get("/api/auth/me", () => HttpResponse.json({ user: { id: "u", name: "Client", email: "c@example.com" }, organization: { id: "o", name: "O", slug: "o" }, role: "CLIENT_ADMIN", clientIds: ["c1"] })),
    http.get(path, () => { reads++; return HttpResponse.json(connected); }),
  );
  renderWithProviders(<MetaIntegration projectId="p1" />);

  await waitFor(() => expect(screen.queryByRole("button", { name: "Meta API" })).not.toBeInTheDocument());
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(reads).toBe(0);
});
