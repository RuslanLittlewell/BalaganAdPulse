import { http as mock, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aClient, aProject, aSession, renderWithProviders, server } from "@test/shared/index.js";
import { ShareDialog } from "@/features/project-share/index.js";
import { App } from "@/app/App.js";
import { clearTokens, writeTokens } from "@/shared/lib/index.js";
import { makeAccessToken } from "@test/shared/index.js";

const FIRST = "a".repeat(43);
const SECOND = "b".repeat(43);
const LINK = "/api/projects/p1/share-link";
const addressOf = (token: string) => `${window.location.origin}/share/${token}`;

function stubClipboard() {
  const written: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: (text: string) => { written.push(text); return Promise.resolve(); } },
  });
  return written;
}

function serveLink(initial: string | null) {
  let token = initial;
  const sent: { method: string; body?: unknown }[] = [];
  server.use(
    mock.get(LINK, () => HttpResponse.json(token ? { token, createdAt: "2026-11-12T10:00:00.000Z" } : null)),
    mock.put(LINK, async ({ request }) => {
      const body = (await request.json()) as { renew: boolean };
      sent.push({ method: "PUT", body });
      const created = token === null;
      if (created || body.renew) token = token === FIRST ? SECOND : FIRST;
      return HttpResponse.json({ token, createdAt: "2026-11-12T10:00:00.000Z" }, { status: created ? 201 : 200 });
    }),
    mock.delete(LINK, () => {
      sent.push({ method: "DELETE" });
      token = null;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

const renderDialog = () => renderWithProviders(<ShareDialog projectId="p1" open onClose={() => {}} />);

describe("the share dialog", () => {
  it("creates the project's link when it has none and shows its full address", async () => {
    const user = userEvent.setup();
    const sent = serveLink(null);
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Создать ссылку" }));

    expect(await screen.findByText(addressOf(FIRST))).toBeInTheDocument();
    expect(sent).toEqual([{ method: "PUT", body: { renew: false } }]);
  });

  it("shows the existing link again and copies its address with a confirmation", async () => {
    const user = userEvent.setup();
    const written = stubClipboard();
    serveLink(FIRST);
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Скопировать ссылку" }));

    expect(written).toEqual([addressOf(FIRST)]);
    expect(await screen.findByRole("status")).toHaveTextContent("Скопировано");
  });

  it("asks before replacing the link, warns that the address stops working, and shows the new one", async () => {
    const user = userEvent.setup();
    const sent = serveLink(FIRST);
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Заменить ссылку" }));

    expect(screen.getByText(/Текущая ссылка перестанет работать/)).toBeInTheDocument();
    expect(sent).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Заменить" }));

    expect(await screen.findByText(addressOf(SECOND))).toBeInTheDocument();
    expect(sent).toEqual([{ method: "PUT", body: { renew: true } }]);
    expect(screen.queryByText(/Текущая ссылка перестанет работать/)).not.toBeInTheDocument();
  });

  it("changes nothing when the replacement is cancelled", async () => {
    const user = userEvent.setup();
    const sent = serveLink(FIRST);
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Заменить ссылку" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.getByText(addressOf(FIRST))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Заменить ссылку" })).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("asks before switching the link off, then offers to create a new one", async () => {
    const user = userEvent.setup();
    const sent = serveLink(FIRST);
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Отключить ссылку" }));

    expect(screen.getByText(/проект нельзя будет открыть без входа/)).toBeInTheDocument();
    expect(sent).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Отключить" }));

    expect(await screen.findByRole("button", { name: "Создать ссылку" })).toBeInTheDocument();
    expect(screen.queryByText(addressOf(FIRST))).not.toBeInTheDocument();
    expect(sent).toEqual([{ method: "DELETE" }]);
  });

  it("says so when a change fails, and keeps the link it had", async () => {
    const user = userEvent.setup();
    serveLink(FIRST);
    server.use(mock.put(LINK, () => HttpResponse.json({ error: { message: "down" } }, { status: 503 })));
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Заменить ссылку" }));
    await user.click(screen.getByRole("button", { name: "Заменить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось изменить ссылку");
    expect(screen.getByText(addressOf(FIRST))).toBeInTheDocument();
  });
});

describe("sharing from the project header", () => {
  function serveProject(role: string) {
    server.use(
      mock.get("/api/auth/me", () => HttpResponse.json(aSession({ role: role as never }))),
      mock.get("/api/clients", () => HttpResponse.json([aClient({ id: "cl1", name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "p1", clientId: "cl1", name: "Клиника" })])),
      mock.get("/api/tasks", () => HttpResponse.json([])),
    );
  }

  function renderAppAt(path: string) {
    window.history.pushState({}, "", path);
    return render(<App />);
  }

  beforeEach(() => {
    clearTokens();
    writeTokens({ accessToken: makeAccessToken(), refreshToken: "r" });
  });

  it("offers an admin «Поделиться» beside «Превью», which opens the dialog", async () => {
    const user = userEvent.setup();
    serveProject("ADMIN");
    serveLink(FIRST);
    renderAppAt("/projects/p1");

    expect(await screen.findByRole("button", { name: "Превью" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Поделиться" }));

    expect(await screen.findByRole("dialog", { name: "Ссылка на проект" })).toBeInTheDocument();
    expect(await screen.findByText(addressOf(FIRST))).toBeInTheDocument();
  });

  it.each(["MANAGER", "GUEST", "CLIENT", "CLIENT_ADMIN"])("offers a %s no sharing", async (role) => {
    serveProject(role);
    renderAppAt("/projects/p1");

    expect(await screen.findByRole("heading", { name: "Клиника" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Поделиться" })).not.toBeInTheDocument());
  });

  it("is absent in preview", async () => {
    serveProject("ADMIN");
    renderAppAt("/projects/p1?preview=1");

    expect(await screen.findByRole("button", { name: "Выйти из превью" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Поделиться" })).not.toBeInTheDocument();
  });
});
