import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { LoadedTaskCalendar as TaskCalendar } from "@test/shared/task-widgets.js";

const TODAY = "2026-09-17";

const weekly = aTask({
  title: "Созвон по проекту",
  dueDate: "2026-09-16",
  dueTime: "12:00",
  repeatEvery: "WEEKLY",
});

function calendar(tasks: unknown[]) {
  server.use(mock.get("/api/tasks", () => HttpResponse.json(tasks)));
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskCalendar today={TODAY} />} /></Routes>,
    { route: "/tasks" },
  );
}

describe("completing a repeating task from the calendar", () => {
  it("offers the control only on a task that repeats", async () => {
    calendar([weekly, aTask({ id: "task-2", title: "Разовая", dueDate: "2026-09-16" })]);

    const wednesday = await screen.findByRole("group", { name: /среда/ });
    expect(await within(wednesday).findByRole("button", { name: "Выполнено" })).toBeInTheDocument();
    expect(within(wednesday).getAllByRole("button", { name: "Выполнено" })).toHaveLength(1);
  });

  it("moves the card to the next week's day", async () => {
    let completed = false;
    server.use(mock.post("/api/tasks/task-1/complete", () => {
      completed = true;
      return HttpResponse.json({ ...weekly, dueDate: "2026-09-23" });
    }));
    calendar([weekly]);

    await userEvent.click(await screen.findByRole("button", { name: "Выполнено" }));
    await waitFor(() => expect(completed).toBe(true));
    await waitFor(() => expect(screen.queryByText("Созвон по проекту")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Следующая неделя" }));
    const wednesday = await screen.findByRole("group", { name: /среда/ });
    expect(within(wednesday).getByText("Созвон по проекту")).toBeInTheDocument();
  });

  it("does not open the task when the control is used", async () => {
    let opened = 0;
    server.use(mock.post("/api/tasks/task-1/complete", () =>
      HttpResponse.json({ ...weekly, dueDate: "2026-09-23" })));
    server.use(mock.get("/api/tasks", () => HttpResponse.json([weekly])));
    renderWithProviders(
      <Routes>
        <Route path="*" element={<TaskCalendar today={TODAY} onOpen={() => { opened += 1; }} />} />
      </Routes>,
      { route: "/tasks" },
    );

    await userEvent.click(await screen.findByRole("button", { name: "Выполнено" }));
    expect(opened).toBe(0);
  });

  it("tells the member when the server refuses", async () => {
    server.use(mock.post("/api/tasks/task-1/complete", () =>
      HttpResponse.json({ error: { message: "нельзя" } }, { status: 403 })));
    calendar([weekly]);

    await userEvent.click(await screen.findByRole("button", { name: "Выполнено" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось перенести задачу");
    expect(screen.getByText("Созвон по проекту")).toBeInTheDocument();
  });

  it("offers a guest no completion control", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Guest", email: "g@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "GUEST",
      clientIds: [],
    })));
    calendar([weekly]);

    await screen.findByText("Созвон по проекту");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Выполнено" })).not.toBeInTheDocument());
  });
});
