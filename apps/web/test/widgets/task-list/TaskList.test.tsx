import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskList } from "@/widgets/task-list/index.js";

const tasks = [
  aTask({ id: "t1", title: "Переписать объявления", column: "IN_PROGRESS", priority: "HIGH" }),
  aTask({ id: "t2", title: "Согласовать бюджет", column: "IDEA", priority: "LOW" }),
];

describe("TaskList", () => {
  it("names each task with its stage and priority", async () => {
    renderWithProviders(
      <TaskList title="Задачи" tasks={tasks} onOpen={() => {}} />,
      { route: "/projects" },
    );

    const row = await screen.findByRole("button", { name: /Переписать объявления/ });
    expect(within(row).getByText("В работе")).toBeInTheDocument();
    expect(within(row).getByText("Высокий")).toBeInTheDocument();
  });

  it("shows a task as the board does, with its stage", async () => {
    server.use(mock.get("/api/members", () => HttpResponse.json([
      { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
    ])));
    renderWithProviders(
      <TaskList
        title="Задачи"
        onOpen={() => {}}
        tasks={[aTask({
          id: "t1", title: "Исправить креативы", column: "IN_REVIEW", priority: "URGENT", assigneeId: "member-1",
          dueDate: "2026-10-02", dueTime: "14:00", repeatEvery: "DAILY",
          checklist: [
            { id: "c1", title: "Баннер", done: true, position: 0 },
            { id: "c2", title: "Видео", done: true, position: 1 },
            { id: "c3", title: "Сторис", done: false, position: 2 },
          ],
          imageIds: ["i1", "i2"],
        })]}
      />,
      { route: "/projects" },
    );

    const card = await screen.findByRole("button", { name: /Исправить креативы/ });
    expect(await within(card).findByText("Пётр")).toBeInTheDocument();
    expect(within(card).getByText("Срочный")).toBeInTheDocument();
    expect(within(card).getByText("На проверке")).toBeInTheDocument();
    expect(within(card).getByText("02.10 14:00")).toBeInTheDocument();
    expect(within(card).getByLabelText("Повторяется")).toBeInTheDocument();
    expect(within(card).getByText("2/3")).toBeInTheDocument();
    expect(within(card).getByLabelText("Вложений: 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Перетащить задачу" })).toBeNull();
  });

  it("leaves out of a bare task's card what it lacks", async () => {
    renderWithProviders(
      <TaskList title="Задачи" onOpen={() => {}} tasks={[aTask({ id: "t1", title: "Созвон" })]} />,
      { route: "/projects" },
    );

    const card = await screen.findByRole("button", { name: /Созвон/ });
    expect(within(card).queryByText(/^\d{2}\.\d{2}/)).toBeNull();
    expect(within(card).queryByText(/^\d+\/\d+$/)).toBeNull();
    expect(within(card).queryByLabelText(/Вложений/)).toBeNull();
  });

  it("carries its own heading", async () => {
    renderWithProviders(<TaskList title="Задачи проекта" tasks={tasks} />, { route: "/projects" });

    expect(await screen.findByRole("heading", { name: "Задачи проекта" })).toBeInTheDocument();
  });

  it("offers a new task in place of the empty note when it is given what to do with one", async () => {
    const user = userEvent.setup();
    let created = 0;
    renderWithProviders(
      <TaskList title="Задачи" tasks={[]} empty="Нет задач в работе" onCreate={() => { created += 1; }} />,
      { route: "/projects" },
    );

    await user.click(await screen.findByRole("button", { name: "Новая задача" }));

    expect(created).toBe(1);
    expect(screen.queryByText("Нет задач в работе")).toBeNull();
  });

  it("offers a new task after the tasks", async () => {
    renderWithProviders(
      <TaskList title="Задачи" tasks={tasks} onOpen={() => {}} onCreate={() => {}} />,
      { route: "/projects" },
    );

    await screen.findByText("Переписать объявления");
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[2]).getByRole("button", { name: "Новая задача" })).toBeInTheDocument();
  });

  it("offers no new task otherwise", async () => {
    renderWithProviders(<TaskList title="Задачи" tasks={tasks} />, { route: "/projects" });

    await screen.findByRole("heading", { name: "Задачи" });
    expect(screen.queryByRole("button", { name: "Новая задача" })).toBeNull();
  });

  it("opens a task when its row is chosen", async () => {
    const user = userEvent.setup();
    const opened: string[] = [];
    renderWithProviders(
      <TaskList title="Задачи" tasks={tasks} onOpen={(task) => opened.push(task.id)} />,
      { route: "/projects" },
    );

    await user.click(await screen.findByRole("button", { name: /Согласовать бюджет/ }));

    expect(opened).toEqual(["t2"]);
  });

  it("says so when there is nothing to show", async () => {
    renderWithProviders(
      <TaskList title="Задачи" tasks={[]} empty="Нет задач в работе" />,
      { route: "/projects" },
    );

    expect(await screen.findByText("Нет задач в работе")).toBeInTheDocument();
  });

  it("leaves rows inert when nothing opens them", async () => {
    renderWithProviders(<TaskList title="Задачи" tasks={tasks} />, { route: "/projects" });

    await screen.findByText("Переписать объявления");
    expect(screen.queryByRole("button", { name: /Согласовать бюджет/ })).toBeNull();
  });
});
