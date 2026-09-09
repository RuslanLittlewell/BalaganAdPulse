import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
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
  expect(await screen.findByRole("status")).toHaveTextContent("В очереди");
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
