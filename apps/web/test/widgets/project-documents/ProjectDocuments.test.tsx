import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders, server } from "@test/shared/index.js";
import { ProjectPage } from "@/pages/project/index.js";

const author = { id: "member-1", name: "Роман Р." };

type Stored = { id: string; title: string; content: unknown | null; createdAt: string; updatedAt: string };

function documentOf(entry: Stored) {
  return { ...entry, projectId: "p1", createdBy: author, updatedBy: author };
}

function summaryOf(entry: Stored) {
  const { content: _content, ...rest } = entry;
  return { ...rest, projectId: "p1", updatedBy: author };
}

function notebook(initial: Stored[] = [], options: { failSaves?: boolean } = {}) {
  const stored = [...initial];
  const saves: Record<string, unknown>[] = [];
  const deleted: string[] = [];
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([{
      id: "p1", clientId: "cl1", name: "Клиника", budgetCurrency: "BYN",
      priority: "NEW", image: null, avatarPath: null, position: 0, createdAt: "", updatedAt: "",
    }])),
    mock.get("/api/clients", () => HttpResponse.json([{ id: "cl1", name: "Acme", orgId: "o1" }])),
    mock.get("/api/projects/:projectId/summary", () => HttpResponse.json(null)),
    mock.get("/api/projects/:projectId/kpi", () => HttpResponse.json(null)),
    mock.get("/api/tasks", () => HttpResponse.json([])),
    mock.get("/api/projects/p1/documents", () => HttpResponse.json(stored.map(summaryOf))),
    mock.get("/api/projects/p1/documents/:id", ({ params }) => {
      const found = stored.find((entry) => entry.id === params.id);
      return found
        ? HttpResponse.json(documentOf(found))
        : HttpResponse.json({ error: { message: "Document not found" } }, { status: 404 });
    }),
    mock.post("/api/projects/p1/documents", async ({ request }) => {
      const { title } = await request.json() as { title: string };
      const created = { id: `doc-${stored.length + 1}`, title: title.trim(), content: null, createdAt: "2026-10-13T10:00:00.000Z", updatedAt: "2026-10-13T10:00:00.000Z" };
      stored.push(created);
      return HttpResponse.json(documentOf(created), { status: 201 });
    }),
    mock.patch("/api/projects/p1/documents/:id", async ({ params, request }) => {
      const change = await request.json() as Record<string, unknown>;
      saves.push(change);
      if (options.failSaves) return HttpResponse.json({ error: { message: "Boom" } }, { status: 500 });
      const index = stored.findIndex((entry) => entry.id === params.id);
      stored[index] = { ...stored[index]!, ...change, updatedAt: "2026-10-13T11:00:00.000Z" } as Stored;
      return HttpResponse.json(documentOf(stored[index]!));
    }),
    mock.delete("/api/projects/p1/documents/:id", ({ params }) => {
      deleted.push(String(params.id));
      const index = stored.findIndex((entry) => entry.id === params.id);
      stored.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { saves, deleted };
}

const entry = (id: string, title: string, content: unknown | null = null): Stored => ({
  id, title, content, createdAt: "2026-10-12T14:25:00.000Z", updatedAt: "2026-10-12T14:25:00.000Z",
});

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/projects/:projectId/documents" element={<ProjectPage />} />
        <Route path="/projects/:projectId/documents/:documentId" element={<ProjectPage />} />
      </Routes>
      <Where />
    </>
  );
}

const open = (route: string) => renderWithProviders(<App />, { route });

const signedInAs = (role: string) => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id: "user-9", name: "Участник", email: "member@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role,
  clientIds: ["cl1"],
  modules: ["DASHBOARD", "PROJECTS", "CRM", "TASKS", "REPORTS"],
})));

async function editorSurface(): Promise<HTMLElement> {
  const wrapper = await screen.findByTestId("document-editor");
  return waitFor(() => {
    const editable = wrapper.querySelector<HTMLElement>("[contenteditable]");
    if (!editable) throw new Error("the editor has not mounted yet");
    return editable;
  });
}

describe("the project's tabs", () => {
  it("switches between the project and its documents, keeping the period", async () => {
    const user = userEvent.setup();
    notebook([entry("doc-1", "О проекте")]);
    open("/projects/p1?from=2026-09-01&to=2026-09-30");

    await user.click(await screen.findByRole("radio", { name: "Документы" }));

    expect(screen.getByTestId("where")).toHaveTextContent("/projects/p1/documents?from=2026-09-01&to=2026-09-30");
    expect(await screen.findByRole("navigation", { name: "Документы проекта" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Метрики" })).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Проект" }));

    expect(screen.getByTestId("where")).toHaveTextContent("/projects/p1?from=2026-09-01&to=2026-09-30");
    expect(await screen.findByRole("heading", { name: "Метрики" })).toBeInTheDocument();
  });

  it("shows a customer no tabs and no documents", async () => {
    notebook([entry("doc-1", "О проекте")]);
    signedInAs("CLIENT");
    open("/projects/p1/documents");

    expect(await screen.findByRole("heading", { name: "Метрики" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Документы" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Документы проекта" })).toBeNull();
  });
});

describe("the notebook", () => {
  it("lists the documents in the order given and opens one beside the list", async () => {
    const user = userEvent.setup();
    notebook([entry("doc-1", "О проекте"), entry("doc-2", "Стратегия", { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Расти через Reels" }] }] }), entry("doc-3", "Конкуренты")]);
    open("/projects/p1/documents");

    const list = await screen.findByRole("navigation", { name: "Документы проекта" });
    await waitFor(() => expect(within(list).getAllByRole("button").map((button) => button.querySelector("span")?.textContent))
      .toEqual(["О проекте", "Стратегия", "Конкуренты"]));
    expect(screen.getByText("Выберите документ в списке")).toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: /Стратегия/ }));

    expect(screen.getByTestId("where")).toHaveTextContent("/projects/p1/documents/doc-2");
    expect(await screen.findByText("Расти через Reels")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Название документа" })).toHaveValue("Стратегия");
    expect(within(list).getByRole("button", { name: /Стратегия/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/^Изменено .* · Роман Р\.$/)).toBeInTheDocument();
  });

  it("invites a manager to create the first document", async () => {
    notebook();
    open("/projects/p1/documents");

    expect(await screen.findByText("Документов пока нет")).toBeInTheDocument();
    expect(screen.getByText("Создавайте документы о проекте: описание, стратегию, конкурентов")).toBeInTheDocument();
  });

  it("creates a document from a dialog and opens it", async () => {
    const user = userEvent.setup();
    notebook();
    open("/projects/p1/documents");

    await user.click(await screen.findByRole("button", { name: "Добавить документ" }));
    const dialog = await screen.findByRole("dialog", { name: "Новый документ" });
    await user.type(within(dialog).getByLabelText("Название документа"), "О проекте");
    await user.click(within(dialog).getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/projects/p1/documents/doc-1"));
    expect(await screen.findByRole("textbox", { name: "Название документа" })).toHaveValue("О проекте");
    expect(within(screen.getByRole("navigation", { name: "Документы проекта" })).getByRole("button", { name: /О проекте/ })).toBeInTheDocument();
  });

  it("asks for a title before creating", async () => {
    const user = userEvent.setup();
    notebook();
    open("/projects/p1/documents");

    await user.click(await screen.findByRole("button", { name: "Добавить документ" }));
    const dialog = await screen.findByRole("dialog", { name: "Новый документ" });
    await user.click(within(dialog).getByRole("button", { name: "Создать" }));

    expect(within(dialog).getByText("Введите название документа")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/projects/p1/documents");
  });

  it("saves a new title on its own once typing stops, and lists it", async () => {
    const user = userEvent.setup();
    const { saves } = notebook([entry("doc-1", "Стратегия")]);
    open("/projects/p1/documents/doc-1");

    const title = await screen.findByRole("textbox", { name: "Название документа" });
    await user.type(title, " на Q4");

    await waitFor(() => expect(saves).toEqual([{ title: "Стратегия на Q4" }]), { timeout: 3000 });
    expect(await screen.findByText("Сохранено")).toHaveAttribute("role", "status");
    expect(within(screen.getByRole("navigation", { name: "Документы проекта" })).getByRole("button", { name: /Стратегия на Q4/ })).toBeInTheDocument();
  });

  it("saves the text on its own once typing stops", async () => {
    const user = userEvent.setup();
    const { saves } = notebook([entry("doc-1", "О проекте")]);
    open("/projects/p1/documents/doc-1");

    await user.click(await editorSurface());
    await user.keyboard("Клиника");

    await waitFor(() => expect(saves).toHaveLength(1), { timeout: 3000 });
    expect(JSON.stringify(saves[0])).toContain("Клиника");
    expect(saves[0]).not.toHaveProperty("title");
  });

  it("saves a change at once when the member leaves the document", async () => {
    const user = userEvent.setup();
    const { saves } = notebook([entry("doc-1", "Стратегия"), entry("doc-2", "Конкуренты")]);
    open("/projects/p1/documents/doc-1");

    await user.type(await screen.findByRole("textbox", { name: "Название документа" }), "!");
    await user.click(within(screen.getByRole("navigation", { name: "Документы проекта" })).getByRole("button", { name: /Конкуренты/ }));

    await waitFor(() => expect(saves).toEqual([{ title: "Стратегия!" }]), { timeout: 500 });
    expect(await screen.findByRole("textbox", { name: "Название документа" })).toHaveValue("Конкуренты");
  });

  it("says so when a change cannot be saved and keeps it on screen", async () => {
    const user = userEvent.setup();
    notebook([entry("doc-1", "Стратегия")], { failSaves: true });
    open("/projects/p1/documents/doc-1");

    const title = await screen.findByRole("textbox", { name: "Название документа" });
    await user.type(title, "!");

    expect(await screen.findByText("Не удалось сохранить", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(title).toHaveValue("Стратегия!");
  });

  it("deletes a document once confirmed and returns to the list", async () => {
    const user = userEvent.setup();
    const { deleted } = notebook([entry("doc-1", "Конкуренты")]);
    open("/projects/p1/documents/doc-1");

    await user.click(await screen.findByRole("button", { name: "Удалить документ" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Удалить документ?" });
    expect(confirm).toHaveTextContent("«Конкуренты» будет удалён безвозвратно.");
    await user.click(within(confirm).getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(deleted).toEqual(["doc-1"]));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/\/projects\/p1\/documents$/));
    expect(await screen.findByText("Документов пока нет")).toBeInTheDocument();
  });

  it("keeps a document when the deletion is declined", async () => {
    const user = userEvent.setup();
    const { deleted } = notebook([entry("doc-1", "Конкуренты")]);
    open("/projects/p1/documents/doc-1");

    await user.click(await screen.findByRole("button", { name: "Удалить документ" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Удалить документ?" });
    await user.click(within(confirm).getByRole("button", { name: "Отмена" }));

    expect(deleted).toEqual([]);
    expect(screen.getByRole("textbox", { name: "Название документа" })).toHaveValue("Конкуренты");
  });

  it("says a document that does not exist is not found", async () => {
    notebook([entry("doc-1", "О проекте")]);
    open("/projects/p1/documents/missing");

    expect(await screen.findByText("Документ не найден")).toBeInTheDocument();
  });

  it("shows a guest documents read-only", async () => {
    notebook([entry("doc-1", "О проекте", { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Описание" }] }] })]);
    signedInAs("GUEST");
    open("/projects/p1/documents/doc-1");

    expect(await screen.findByRole("heading", { name: "О проекте", level: 2 })).toBeInTheDocument();
    expect(await screen.findByText("Описание")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Название документа" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Добавить документ" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Удалить документ" })).toBeNull();
    expect(screen.queryByTestId("document-toolbar")).toBeNull();
    const surface = await editorSurface();
    expect(surface).toHaveAttribute("contenteditable", "false");
  });
});
