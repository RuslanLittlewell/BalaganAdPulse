import { act, fireEvent, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { aSession, aTask, hookWrapper, renderWithProviders, server } from "@test/shared/index.js";
import { useAuth } from "@/features/auth/model/AuthProvider.js";
import { hasSession } from "@/shared/lib/auth/tokenStore.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import { useCreativeFile } from "@/entities/campaign/index.js";
import { useReportCover } from "@/entities/report/api/queries.js";

afterEach(() => vi.restoreAllMocks());

it("keeps the new identity when an old session response arrives after another sign-in", async () => {
  let reads = 0;
  let release: (() => void) | undefined;
  let oldReturned = false;
  server.use(
    http.get("/api/auth/me", async () => {
      if (++reads === 1) {
        await new Promise<void>((resolve) => { release = resolve; });
        oldReturned = true;
        return HttpResponse.json(aSession({ user: { id: "old", name: "Old", email: null, login: null, image: null } }));
      }
      return HttpResponse.json(aSession({ user: { id: "new", name: "New", email: null, login: null, image: null } }));
    }),
    http.post("/api/auth/login", () => HttpResponse.json({ accessToken: "new", refreshToken: "r" })),
  );
  let auth!: ReturnType<typeof useAuth>;
  function Probe() { auth = useAuth(); return <output data-testid="identity">{auth.user?.id ?? "none"}</output>; }
  renderWithProviders(<Probe />);
  await waitFor(() => expect(release).toBeTypeOf("function"));
  await act(async () => { await auth.logout(); });
  await act(async () => { await auth.login({ login: "new", password: "password" }); });
  expect(screen.getByTestId("identity")).toHaveTextContent("new");
  await act(async () => { release?.(); });
  await waitFor(() => expect(oldReturned).toBe(true));
  expect(screen.getByTestId("identity")).toHaveTextContent("new");
});

it("keeps the session through a bootstrap 503 and recovers on retry", async () => {
  let unavailable = true;
  server.use(http.get("/api/auth/me", () => unavailable
    ? HttpResponse.json({ error: { message: "Unavailable" } }, { status: 503 })
    : HttpResponse.json(aSession())));
  let auth!: ReturnType<typeof useAuth>;
  function Probe() { auth = useAuth(); return <output data-testid="identity">{auth.user?.id ?? "none"}</output>; }
  renderWithProviders(<Probe />);
  await waitFor(() => expect(auth.sessionError).toBe(true));
  expect(hasSession()).toBe(true);
  unavailable = false;
  act(() => auth.retrySession());
  await waitFor(() => expect(auth.user?.id).toBe("user-1"));
  expect(auth.sessionError).toBe(false);
});

it("blocks duplicate task submits while pending and permits a deliberate retry after failure", async () => {
  let posts = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  server.use(http.post("/api/tasks", async () => {
    if (++posts === 1) {
      await pending;
      return HttpResponse.json({ error: { message: "Unavailable" } }, { status: 503 });
    }
    return HttpResponse.json(aTask(), { status: 201 });
  }));
  renderWithProviders(<TaskFormDialog onClose={() => {}} />);
  await userEvent.type(await screen.findByLabelText("Название"), "One task");
  const submit = screen.getByRole("button", { name: "Создать задачу" });
  await userEvent.click(submit);
  await waitFor(() => expect(posts).toBe(1));
  expect(submit).toBeDisabled();
  fireEvent.submit(submit.closest("form")!);
  expect(posts).toBe(1);
  await act(async () => { release?.(); });
  await waitFor(() => expect(submit).toBeEnabled());
  await userEvent.click(submit);
  await waitFor(() => expect(posts).toBe(2));
});

it.each(["creative", "cover"])("reuses %s bytes while releasing each view URL", async (kind) => {
  let reads = 0;
  const path = kind === "creative" ? "/api/ad-creatives/media/file" : "/api/projects/p1/reports/r1/cover";
  server.use(http.get(path, () => { reads++; return new HttpResponse(new Uint8Array([1, 2, 3])); }));
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const wrapper = hookWrapper();
  const read = () => kind === "creative" ? useCreativeFile("media", "file")
    : useReportCover({ id: "r1", projectId: "p1", hasCover: true, updatedAt: "v1" });
  const first = renderHook(read, { wrapper });
  await waitFor(() => expect(first.result.current.data).toMatch(/^blob:/));
  const firstUrl = first.result.current.data;
  first.unmount();
  expect(revoke).toHaveBeenCalledWith(firstUrl);
  const second = renderHook(read, { wrapper });
  await waitFor(() => expect(second.result.current.data).toMatch(/^blob:/));
  expect(reads).toBe(1);
  const secondUrl = second.result.current.data;
  second.unmount();
  expect(revoke).toHaveBeenCalledWith(secondUrl);
  wrapper.client.clear();
});
