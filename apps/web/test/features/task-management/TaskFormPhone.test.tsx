import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";

const members = [
  { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

const asRole = (role: string) => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id: "u1", name: "Кто-то", email: "s@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role,
  clientIds: [],
})));

let sent: Record<string, unknown> | null = null;

beforeEach(() => {
  sent = null;
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query === "not all and (min-width: 48rem)",
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList);
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1", name: "Летний запуск" })])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/tasks/:id/participants", () => HttpResponse.json([])),
    mock.post("/api/tasks", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: "task-1" }, { status: 201 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const topBar = () => screen.getByRole("dialog").querySelector<HTMLElement>("[data-slot='dialog-header']")!;

describe("a task on a phone", () => {
  it("holds the close control, the title and the save button in its top bar, once each", async () => {
    renderWithProviders(<TaskFormDialog onClose={() => {}} />, { route: "/tasks" });
    await screen.findByLabelText("Название");

    const bar = within(topBar());
    expect(bar.getByRole("button", { name: "Отмена" })).toBeInTheDocument();
    expect(bar.getByRole("heading", { name: "Новая задача" })).toBeInTheDocument();
    expect(bar.getByRole("button", { name: "Создать задачу" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Создать задачу" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Отмена" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Закрыть" })).not.toBeInTheDocument();
  });

  it("creates the task from the top bar and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<TaskFormDialog onClose={onClose} />, { route: "/tasks" });

    await user.type(await screen.findByLabelText("Название"), "Заметка");
    await user.click(within(topBar()).getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(sent).toMatchObject({ title: "Заметка" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("closes from the top bar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<TaskFormDialog onClose={onClose} />, { route: "/tasks" });
    await screen.findByLabelText("Название");

    await user.click(within(topBar()).getByRole("button", { name: "Отмена" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("brings the stage and the priority right after the title, in the page", async () => {
    renderWithProviders(<TaskFormDialog task={aTask({ projectId: "project-1" })} onClose={() => {}} />, { route: "/tasks" });
    const title = await screen.findByLabelText("Название");

    const stage = screen.getByLabelText("Этап");
    const priority = screen.getByLabelText("Приоритет");
    expect(within(topBar()).queryByLabelText("Приоритет")).not.toBeInTheDocument();
    expect(title.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stage.compareDocumentPosition(priority) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps sharing with the client and deleting at the end of the page", async () => {
    asRole("ADMIN");
    renderWithProviders(
      <TaskFormDialog task={aTask({ projectId: "project-1" })} onClose={() => {}} onDelete={() => {}} />,
      { route: "/tasks" },
    );

    const footer = await screen.findByTestId("task-form-footer");
    expect(within(footer).getByRole("switch", { name: "Видно клиенту" })).toBeInTheDocument();
    expect(within(footer).getByRole("button", { name: "Удалить" })).toBeInTheDocument();
    expect(within(footer).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
  });

  it("leaves the footer out when it would hold nothing", async () => {
    renderWithProviders(<TaskFormDialog onClose={() => {}} />, { route: "/tasks" });
    await screen.findByLabelText("Название");

    expect(screen.queryByTestId("task-form-footer")).not.toBeInTheDocument();
  });

  it("offers a read-only task a close control and no save", async () => {
    asRole("CLIENT");
    renderWithProviders(
      <TaskFormDialog task={aTask({ projectId: "project-1", personal: false })} onClose={() => {}} />,
      { route: "/tasks" },
    );

    await waitFor(() => expect(within(topBar()).getByRole("heading", { name: "Задача" })).toBeInTheDocument());
    expect(within(topBar()).getByRole("button", { name: "Закрыть" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
  });
});
