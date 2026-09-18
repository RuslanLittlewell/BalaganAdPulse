import { http as mock, HttpResponse } from "msw";
import { screen } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { LoadedTaskBoard as TaskBoard } from "@test/shared/task-widgets.js";

function board(tasks: unknown[]) {
  server.use(mock.get("/api/tasks", () => HttpResponse.json(tasks)));
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskBoard />} /></Routes>,
    { route: "/tasks" },
  );
}

describe("what a card says about a task's schedule", () => {
  it("says nothing when the task has no due date", async () => {
    board([aTask({ title: "Без срока" })]);
    await screen.findByText("Без срока");
    expect(screen.queryByTestId("task-due-task-1")).not.toBeInTheDocument();
  });

  it("shows the day a task is due", async () => {
    board([aTask({ dueDate: "2026-09-25" })]);
    expect(await screen.findByTestId("task-due-task-1")).toHaveTextContent("25.09");
  });

  it("shows the time of day when the task has one", async () => {
    board([aTask({ dueDate: "2026-09-25", dueTime: "12:00" })]);
    expect(await screen.findByTestId("task-due-task-1")).toHaveTextContent("12:00");
  });

  it("marks a task that repeats", async () => {
    board([aTask({ dueDate: "2026-09-25", repeatEvery: "WEEKLY" })]);
    expect(await screen.findByLabelText("Повторяется")).toBeInTheDocument();
  });

  it("leaves a task that does not repeat unmarked", async () => {
    board([aTask({ dueDate: "2026-09-25" })]);
    await screen.findByTestId("task-due-task-1");
    expect(screen.queryByLabelText("Повторяется")).not.toBeInTheDocument();
  });

  it("reports how much of the checklist is ticked", async () => {
    board([aTask({ checklist: [
      { id: "i1", title: "Раз", done: true, position: 0 },
      { id: "i2", title: "Два", done: false, position: 1 },
      { id: "i3", title: "Три", done: false, position: 2 },
    ] })]);
    expect(await screen.findByTestId("task-checklist-task-1")).toHaveTextContent("1/3");
  });

  it("says nothing about a checklist a task does not have", async () => {
    board([aTask({ title: "Без чек-листа" })]);
    await screen.findByText("Без чек-листа");
    expect(screen.queryByTestId("task-checklist-task-1")).not.toBeInTheDocument();
  });
});
