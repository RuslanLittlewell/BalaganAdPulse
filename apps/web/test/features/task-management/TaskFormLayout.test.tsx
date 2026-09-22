import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
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
    mock.get("/api/campaigns/names", () => HttpResponse.json([
      { id: "camp-1", projectId: "project-1", name: "Поиск / Москва", channel: "YANDEX" },
    ])),
    mock.post("/api/tasks", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: "task-1" }, { status: 201 });
    }),
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
const open = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const save = () => userEvent.click(screen.getByRole("button", { name: /Сохранить|Создать задачу/ }));
const shownBlocks = () =>
  [...screen.getByTestId("task-form-body").querySelectorAll("[data-testid^='task-block-']")]
    .map((node) => node.getAttribute("data-testid"));

describe("the blocks a task is composed from", () => {
  it("offers the checklist, the dates and the assignment", async () => {
    creating();
    await screen.findByLabelText("Название");
    expect(offered()).toEqual(BLOCKS);
  });

  it("shows the title, the description and the priority and nothing else", async () => {
    creating();
    expect(await screen.findByLabelText("Название")).toBeInTheDocument();
    expect(screen.getByText("Описание")).toBeInTheDocument();
    expect(screen.getByText("Приоритет")).toBeInTheDocument();

    expect(screen.queryByLabelText("Проект")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ответственный")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Кампания")).not.toBeInTheDocument();
  });

  it("brings the project, the campaign and the responsible member in one block", async () => {
    creating();
    await open("Назначить");

    expect(await screen.findByLabelText("Проект")).toBeInTheDocument();
    expect(screen.getByLabelText("Кампания")).toBeInTheDocument();
    expect(screen.getByLabelText("Ответственный")).toBeInTheDocument();
    expect(offered()).toEqual(["Чек-лист", "Даты"]);
  });

  it("keeps its order whatever order the blocks were added in", async () => {
    creating();
    await open("Назначить");
    await open("Даты");
    await open("Чек-лист");

    expect(shownBlocks())
      .toEqual(["task-block-checklist", "task-block-dates", "task-block-assign"]);
  });

  it("carries the remove control of each block", async () => {
    creating();
    await open("Назначить");

    const block = screen.getByTestId("task-block-assign");
    expect(within(block).getByRole("button", { name: "Убрать назначение" })).toBeInTheDocument();
  });
});

describe("a task the form saves without a project", () => {
  it("offers Без проекта in the project select", async () => {
    creating();
    await open("Назначить");
    await userEvent.click(await screen.findByLabelText("Проект"));

    expect(await screen.findByRole("option", { name: "Без проекта" })).toBeInTheDocument();
  });

  it("creates a task naming no project", async () => {
    creating();
    await userEvent.type(await screen.findByLabelText("Название"), "Заметка");
    await save();

    await waitFor(() => expect(sent).toMatchObject({ title: "Заметка", projectId: null }));
  });

  it("clears the project, the campaign and the responsible member together", async () => {
    edit({ campaignId: "camp-1", assigneeId: "member-1" });
    await userEvent.click(await screen.findByRole("button", { name: "Убрать назначение" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({
      projectId: null, campaignId: null, assigneeId: null,
    }));
  });

  it("shows the assignment block for a task that has a project", async () => {
    edit();
    await screen.findByLabelText("Название");

    expect(screen.getByTestId("task-block-assign")).toBeInTheDocument();
    expect(offered()).toEqual(["Чек-лист", "Даты"]);
  });
});
