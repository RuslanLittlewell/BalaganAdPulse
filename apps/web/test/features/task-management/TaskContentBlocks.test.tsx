import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import type { Task } from "@/entities/task/index.js";

const members = [
  { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

const BLOCKS = ["Чек-лист", "Даты", "Назначить"];

let sent: Record<string, unknown> | null = null;

beforeEach(() => {
  sent = null;
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1", name: "Летний запуск" })])),
    mock.get("/api/members", () => HttpResponse.json(members)),
  );
});

function creating() {
  return renderWithProviders(<TaskFormDialog onClose={() => {}} />, { route: "/tasks" });
}

function edit(task: Partial<Task> = {}) {
  const existing = aTask({ projectId: "project-1", ...task });
  server.use(mock.patch("/api/tasks/:id", async ({ request }) => {
    sent = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...existing, ...sent });
  }));
  return renderWithProviders(
    <TaskFormDialog task={existing} onClose={() => {}} />, { route: "/tasks" },
  );
}

const offered = () => BLOCKS.filter((name) => screen.queryByRole("button", { name }) !== null);
const save = () => userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

describe("a task starts bare", () => {
  it("shows only the title, the description and the priority", async () => {
    creating();
    expect(await screen.findByLabelText("Название")).toBeInTheDocument();
    expect(screen.getByText("Описание")).toBeInTheDocument();
    expect(screen.getByText("Приоритет")).toBeInTheDocument();
    expect(screen.queryByLabelText("Проект")).not.toBeInTheDocument();

    expect(screen.queryByTestId("task-form-schedule")).not.toBeInTheDocument();
    expect(screen.queryByTestId("task-checklist")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Новый пункт")).not.toBeInTheDocument();
  });

  it("offers every block in the row", async () => {
    creating();
    await screen.findByLabelText("Название");
    expect(offered()).toEqual(BLOCKS);
  });

  it("keeps attachments out of the row", async () => {
    creating();
    await screen.findByLabelText("Название");
    expect(screen.getByText("Вложения")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Вложения" })).not.toBeInTheDocument();
  });
});

describe("adding a block", () => {
  it("shows the checklist and takes it out of the row", async () => {
    creating();
    await userEvent.click(await screen.findByRole("button", { name: "Чек-лист" }));

    expect(screen.getByLabelText("Новый пункт")).toBeInTheDocument();
    expect(offered()).toEqual(["Даты", "Назначить"]);
  });

  it("shows the dates block and takes it out of the row", async () => {
    creating();
    await userEvent.click(await screen.findByRole("button", { name: "Даты" }));

    expect(screen.getByTestId("task-form-schedule")).toBeInTheDocument();
    expect(offered()).toEqual(["Чек-лист", "Назначить"]);
  });

  it("shows the project and the responsible member together", async () => {
    creating();
    await userEvent.click(await screen.findByRole("button", { name: "Назначить" }));

    expect(screen.getByRole("combobox", { name: "Проект" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Ответственный" })).toBeInTheDocument();
    expect(offered()).toEqual(["Чек-лист", "Даты"]);
  });
});

describe("a task that already carries a value", () => {
  it("shows the blocks it fills and offers the rest", async () => {
    edit({
      projectId: null,
      dueDate: "2026-09-25",
      checklist: [{ id: "i1", title: "Повестка", done: false, position: 0 }],
    });
    await screen.findByLabelText("Название");

    expect(screen.getByTestId("task-form-schedule")).toBeInTheDocument();
    expect(screen.getByTestId("task-checklist")).toBeInTheDocument();
    expect(offered()).toEqual(["Назначить"]);
  });

  it("shows the assignment a task already has", async () => {
    edit({ assigneeId: "member-1" });
    await screen.findByLabelText("Название");

    expect(screen.getByRole("combobox", { name: "Ответственный" })).toBeInTheDocument();
    expect(offered()).toEqual(["Чек-лист", "Даты"]);
  });

  it("offers every block for a task that carries none of them", async () => {
    edit({ projectId: null });
    await screen.findByLabelText("Название");
    expect(offered()).toEqual(BLOCKS);
  });
});

describe("removing a block", () => {
  it("clears the due date, its time and its repetition", async () => {
    edit({ dueDate: "2026-09-25", dueTime: "12:00", repeatEvery: "WEEKLY" });
    await userEvent.click(await screen.findByRole("button", { name: "Убрать даты" }));

    expect(screen.queryByTestId("task-form-schedule")).not.toBeInTheDocument();
    expect(offered()).toEqual(["Чек-лист", "Даты"]);

    await save();
    await waitFor(() => expect(sent).toMatchObject({
      dueDate: null, dueTime: null, repeatEvery: "NONE",
    }));
  });

  it("leaves the task with nobody responsible", async () => {
    edit({ projectId: null, assigneeId: "member-1" });
    await userEvent.click(await screen.findByRole("button", { name: "Убрать назначение" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ assigneeId: null }));
  });

  it("empties the checklist", async () => {
    edit({ checklist: [{ id: "i1", title: "Повестка", done: false, position: 0 }] });
    await userEvent.click(await screen.findByRole("button", { name: "Убрать чек-лист" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ checklist: [] }));
  });

  it("releases the project when the assignment block is removed", async () => {
    edit({ projectId: "project-1" });
    await userEvent.click(await screen.findByRole("button", { name: "Убрать назначение" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ projectId: null }));
  });
});
