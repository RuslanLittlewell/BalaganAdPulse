import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aTask, renderWithProviders } from "@test/shared/index.js";
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

  it("carries its own heading", async () => {
    renderWithProviders(<TaskList title="Задачи проекта" tasks={tasks} />, { route: "/projects" });

    expect(await screen.findByRole("heading", { name: "Задачи проекта" })).toBeInTheDocument();
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
