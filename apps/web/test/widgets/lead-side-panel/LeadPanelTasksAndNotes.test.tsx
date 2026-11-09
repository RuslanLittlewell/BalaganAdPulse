import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aLead, aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import type { LeadNote } from "@/entities/lead/index.js";
import { toIso } from "@/shared/ui/index.js";
import { LeadSidePanel } from "@/widgets/lead-side-panel/index.js";

const capabilities = { create: true, update: true, delete: true };
const readOnly = { create: false, update: false, delete: false };
const BOARD = "/api/crm/boards/project-1";

const aNote = (overrides: Partial<LeadNote> = {}): LeadNote => ({
  id: "note-1", leadId: "lead-1", author: { id: "member-1", name: "Женя Радюк" }, body: "Просит КП",
  createdAt: "2026-10-01T09:00:00.000Z", editedAt: null, ...overrides,
});

const onLead = (overrides = {}) => aTask({
  id: "t-open", title: "Перезвонить", leadId: "lead-1", lead: { id: "lead-1", name: "Леонид", boardKey: "project-1" },
  dueDate: "2026-10-20", ...overrides,
});

const posted: Array<Record<string, unknown>> = [];
const asked: string[] = [];
let notes: LeadNote[] = [];
let tasks = [onLead()];

function sessionAs(role: string, membershipId = "member-1") {
  server.use(mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Женя Радюк", email: "a@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    membershipId,
    clientIds: [],
  })));
}

beforeEach(() => {
  posted.length = 0;
  asked.length = 0;
  notes = [aNote()];
  tasks = [onLead()];
  server.use(
    mock.get(`${BOARD}/leads`, () => HttpResponse.json([aLead({ id: "lead-1", name: "Леонид", projectId: "project-1" })])),
    mock.get(`${BOARD}/fields`, () => HttpResponse.json([])),
    mock.get(`${BOARD}/columns`, () => HttpResponse.json([])),
    mock.get(`${BOARD}/leads/:id/activity`, () => HttpResponse.json([])),
    mock.get(`${BOARD}/leads/:id/files`, () => HttpResponse.json([])),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get(`${BOARD}/leads/lead-1/notes`, () => HttpResponse.json(notes)),
    mock.post(`${BOARD}/leads/lead-1/notes`, async ({ request }) => {
      const { body } = (await request.json()) as { body: string };
      posted.push({ body });
      const note = aNote({ id: `note-${notes.length + 1}`, body, createdAt: "2026-10-02T09:00:00.000Z" });
      notes = [...notes, note];
      return HttpResponse.json(note, { status: 201 });
    }),
    mock.delete(`${BOARD}/leads/lead-1/notes/:noteId`, ({ params }) => {
      notes = notes.filter((note) => note.id !== params.noteId);
      return new HttpResponse(null, { status: 204 });
    }),
    mock.get("/api/tasks", ({ request }) => {
      asked.push(new URL(request.url).search);
      return HttpResponse.json(tasks);
    }),
    mock.post("/api/tasks", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      posted.push(body);
      const created = onLead({ id: "t-new", title: String(body.title), dueDate: null });
      tasks = [...tasks, created];
      return HttpResponse.json(created, { status: 201 });
    }),
  );
});

const setup = (props: Partial<Parameters<typeof LeadSidePanel>[0]> = {}) =>
  renderWithProviders(
    <LeadSidePanel boardKey="project-1" leadId="lead-1" capabilities={capabilities} onClose={() => {}} {...props} />,
    { route: "/crm" },
  );

const tabsOf = async () => within(await screen.findByRole("radiogroup", { name: "Разделы лида" }));

describe("the Задачи tab of the lead panel", () => {
  it("asks for the tasks of that lead and counts the open ones in the tab", async () => {
    tasks = [onLead(), onLead({ id: "t-done", title: "Отправлено", column: "DONE" })];
    setup();

    expect(await (await tabsOf()).findByRole("radio", { name: "Задачи · 1" })).toBeInTheDocument();
    expect(asked.some((search) => search.includes("leadId=lead-1"))).toBe(true);
  });

  it("lists open tasks first, then done ones", async () => {
    tasks = [onLead({ id: "t-done", title: "Отправлено", column: "DONE", dueDate: "2026-10-01" }), onLead()];
    setup();
    await userEvent.click(await (await tabsOf()).findByRole("radio", { name: /Задачи/ }));

    await screen.findByText("Перезвонить");
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Перезвонить", "Отправлено"]);
  });

  it("creates a task for the open lead without asking for a lead", async () => {
    setup();
    await userEvent.click(await (await tabsOf()).findByRole("radio", { name: /Задачи/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Новая задача" }));

    expect(screen.getByTestId("task-lead-name")).toHaveTextContent("Леонид");
    expect(screen.queryByRole("combobox", { name: "Лид" })).toBeNull();
    await userEvent.type(await screen.findByLabelText("Название"), "Написать в Telegram");
    await userEvent.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ title: "Написать в Telegram", leadId: "lead-1", projectId: "project-1", dueDate: toIso(new Date()) });
    expect(await screen.findByText("Написать в Telegram")).toBeInTheDocument();
  });

  it("shows a lead without tasks a quiet message", async () => {
    tasks = [];
    setup();
    await userEvent.click(await (await tabsOf()).findByRole("radio", { name: "Задачи" }));

    expect(await screen.findByText("У лида пока нет задач")).toBeInTheDocument();
  });

  it("lists the tasks to a guest and offers no create button", async () => {
    sessionAs("GUEST");
    setup({ capabilities: readOnly });
    await userEvent.click(await (await tabsOf()).findByRole("radio", { name: /Задачи/ }));

    expect(await screen.findByText("Перезвонить")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Новая задача" })).toBeNull();
  });

  it("is not offered to a client, who reaches no tasks", async () => {
    sessionAs("CLIENT");
    setup({ capabilities: readOnly });

    const tabs = await tabsOf();
    expect(tabs.queryByRole("radio", { name: /Задачи/ })).toBeNull();
    expect(asked).toEqual([]);
  });
});

describe("the Заметки tab of the lead panel", () => {
  const openNotes = async () => userEvent.click(await (await tabsOf()).findByRole("radio", { name: "Заметки" }));

  it("lists the notes with their author", async () => {
    setup();
    await openNotes();

    expect(await screen.findByText("Просит КП")).toBeInTheDocument();
    expect(screen.getByText("Женя Радюк")).toBeInTheDocument();
  });

  it("sends a note and clears the input", async () => {
    setup();
    await openNotes();
    const field = await screen.findByRole("textbox", { name: "Текст заметки" });
    await userEvent.type(field, "Договорились на пятницу");
    await userEvent.click(screen.getByRole("button", { name: "Добавить заметку" }));

    await waitFor(() => expect(posted).toEqual([{ body: "Договорились на пятницу" }]));
    expect(await screen.findByText("Договорились на пятницу")).toBeInTheDocument();
    expect(field).toHaveValue("");
  });

  it("keeps the typed text when the note is refused", async () => {
    server.use(mock.post(`${BOARD}/leads/lead-1/notes`, () => HttpResponse.json({ error: { message: "A note needs text" } }, { status: 400 })));
    setup();
    await openNotes();
    const field = await screen.findByRole("textbox", { name: "Текст заметки" });
    await userEvent.type(field, "Текст");
    await userEvent.click(screen.getByRole("button", { name: "Добавить заметку" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Добавить заметку" })).toBeEnabled());
    expect(field).toHaveValue("Текст");
  });

  it("shows a lead without notes a quiet message", async () => {
    notes = [];
    setup();
    await openNotes();

    expect(await screen.findByText("Заметок пока нет")).toBeInTheDocument();
  });

  it("lets an author delete their own note", async () => {
    sessionAs("MANAGER", "member-1");
    setup();
    await openNotes();
    await userEvent.click(await screen.findByRole("button", { name: "Удалить заметку" }));

    await waitFor(() => expect(screen.queryByText("Просит КП")).toBeNull());
  });

  it("offers another member's note no edit and no delete", async () => {
    sessionAs("MANAGER", "member-2");
    setup();
    await openNotes();
    await screen.findByText("Просит КП");

    expect(screen.queryByRole("button", { name: "Удалить заметку" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Изменить заметку" })).toBeNull();
  });

  it("lets an admin delete another member's note", async () => {
    sessionAs("ADMIN", "member-2");
    setup();
    await openNotes();

    expect(await screen.findByRole("button", { name: "Удалить заметку" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Изменить заметку" })).toBeNull();
  });

  it("shows a guest the notes and no input", async () => {
    sessionAs("GUEST", "member-3");
    setup({ capabilities: readOnly });
    await openNotes();

    expect(await screen.findByText("Просит КП")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Текст заметки" })).toBeNull();
  });
});
