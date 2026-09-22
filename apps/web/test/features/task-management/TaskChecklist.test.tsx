import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import type { Task } from "@/entities/task/index.js";

const members = [
  { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

const items = [
  { id: "item-1", title: "Собрать креативы", done: false, position: 0 },
  { id: "item-2", title: "Согласовать бюджет", done: true, position: 1 },
];

let sent: Record<string, unknown> | null = null;
let requests = 0;

beforeEach(() => {
  sent = null;
  requests = 0;
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/campaigns/names", () => HttpResponse.json([])),
  );
});

function edit(task: Partial<Task> = {}, onClose = () => {}) {
  const existing = aTask({ projectId: "project-1", checklist: items, ...task });
  server.use(
    mock.patch("/api/tasks/:id", async ({ request }) => {
      requests += 1;
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...existing, ...sent });
    }),
  );
  return renderWithProviders(
    <TaskFormDialog task={existing} onClose={onClose} />, { route: "/tasks" },
  );
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

describe("the checklist of a task being edited", () => {
  it("shows every item with whether it is ticked", async () => {
    edit();
    expect(await screen.findByRole("checkbox", { name: "Собрать креативы" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Согласовать бюджет" })).toBeChecked();
  });

  it("reports how many items are ticked", async () => {
    edit();
    expect(await screen.findByText("1 из 2")).toBeInTheDocument();
  });

  it("sends nothing until the task is saved", async () => {
    edit();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Собрать креативы" }));
    await userEvent.type(screen.getByLabelText("Новый пункт"), "Запустить");
    await userEvent.click(screen.getByRole("button", { name: "Добавить пункт" }));

    expect(requests).toBe(0);
  });

  it("saves the whole list as it now stands", async () => {
    edit();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Собрать креативы" }));
    await userEvent.type(screen.getByLabelText("Новый пункт"), "Запустить");
    await userEvent.click(screen.getByRole("button", { name: "Добавить пункт" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({
      checklist: [
        { title: "Собрать креативы", done: true },
        { title: "Согласовать бюджет", done: true },
        { title: "Запустить", done: false },
      ],
    }));
  });

  it("saves a removed item as gone", async () => {
    edit();
    await userEvent.click((await screen.findAllByRole("button", { name: "Удалить пункт" }))[0]!);
    await save();

    await waitFor(() => expect(sent).toMatchObject({
      checklist: [{ title: "Согласовать бюджет", done: true }],
    }));
  });

  it("leaves the task alone when the form is closed without saving", async () => {
    let closed = false;
    edit({}, () => { closed = true; });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Собрать креативы" }));
    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));

    await waitFor(() => expect(closed).toBe(true));
    expect(requests).toBe(0);
  });

  it("refuses a blank item", async () => {
    edit();
    await userEvent.click(await screen.findByRole("button", { name: "Добавить пункт" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });
});
