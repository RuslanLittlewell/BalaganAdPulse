import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aTask, renderWithProviders } from "@test/shared/index.js";
import { TaskCardView } from "@/features/task-management/index.js";
import type { Task } from "@/entities/task/index.js";

function card(task: Task, handlers: { onOpen?: (task: Task) => void; onToggleDone?: (task: Task) => void }) {
  return renderWithProviders(<TaskCardView task={task} {...handlers} />, { route: "/tasks" });
}

describe("the Готово checkbox on a card", () => {
  it("is not offered when the card is given nothing to do with it", () => {
    card(aTask(), { onOpen: () => {} });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("is named after the task and unticked while the task is not done", () => {
    card(aTask({ column: "IN_PROGRESS" }), { onToggleDone: () => {} });
    expect(screen.getByRole("checkbox", { name: "Готово: Написать бриф" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("is ticked while the task is in Готово", () => {
    card(aTask({ column: "DONE" }), { onToggleDone: () => {} });
    expect(screen.getByRole("checkbox", { name: "Готово: Написать бриф" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("hands the task over when ticked, without opening it", async () => {
    const toggled: string[] = [];
    let opened = 0;
    card(aTask(), { onOpen: () => { opened += 1; }, onToggleDone: (task) => toggled.push(task.id) });

    await userEvent.click(screen.getByRole("checkbox", { name: "Готово: Написать бриф" }));

    expect(toggled).toEqual(["task-1"]);
    expect(opened).toBe(0);
  });

  it("is toggled from the keyboard with Space, without opening the task", async () => {
    const toggled: string[] = [];
    let opened = 0;
    card(aTask(), { onOpen: () => { opened += 1; }, onToggleDone: (task) => toggled.push(task.id) });

    screen.getByRole("checkbox", { name: "Готово: Написать бриф" }).focus();
    await userEvent.keyboard(" ");

    expect(toggled).toEqual(["task-1"]);
    expect(opened).toBe(0);
  });
});
