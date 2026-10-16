import { http as mock, HttpResponse, delay } from "msw";
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

const once = aTask({ id: "task-2", title: "Разовая", dueDate: "2026-09-16", dueTime: "15:00", column: "IN_PROGRESS" });

function calendar(tasks: unknown[], onOpen?: () => void) {
  server.use(mock.get("/api/tasks", () => HttpResponse.json(tasks)));
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskCalendar today={TODAY} onOpen={onOpen} />} /></Routes>,
    { route: "/tasks" },
  );
}

describe("the Готово checkbox in the calendar", () => {
  it("is offered on every task, repeating or not", async () => {
    calendar([weekly, once]);

    const wednesday = await screen.findByRole("group", { name: /среда/ });
    expect(await within(wednesday).findByRole("checkbox", { name: "Готово: Созвон по проекту" })).toBeInTheDocument();
    expect(within(wednesday).getByRole("checkbox", { name: "Готово: Разовая" })).toBeInTheDocument();
  });

  it("moves a weekly call to the next week's day before the server answers", async () => {
    let completed = false;
    server.use(mock.post("/api/tasks/task-1/complete", async () => {
      completed = true;
      await delay(200);
      return HttpResponse.json({ ...weekly, dueDate: "2026-09-23" });
    }));
    calendar([weekly]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Созвон по проекту" }));
    expect(screen.queryByText("Созвон по проекту")).not.toBeInTheDocument();
    await waitFor(() => expect(completed).toBe(true));

    await userEvent.click(screen.getByRole("button", { name: "Следующая неделя" }));
    const wednesday = await screen.findByRole("group", { name: /среда/ });
    expect(within(wednesday).getByText("Созвон по проекту")).toBeInTheDocument();
    expect(within(wednesday).getByRole("checkbox", { name: "Готово: Созвон по проекту" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("closes a task that does not repeat, keeping it on its day", async () => {
    let body: unknown = null;
    server.use(mock.post("/api/tasks/task-2/move", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ ...once, column: "DONE", position: 0 });
    }));
    calendar([once]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Разовая" }));

    await waitFor(() => expect(body).toEqual({ column: "DONE", position: 0 }));
    const wednesday = screen.getByRole("group", { name: /среда/ });
    expect(within(wednesday).getByRole("checkbox", { name: "Готово: Разовая" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("does not open the task when the checkbox is used", async () => {
    let opened = 0;
    server.use(mock.post("/api/tasks/task-1/complete", () =>
      HttpResponse.json({ ...weekly, dueDate: "2026-09-23" })));
    calendar([weekly], () => { opened += 1; });

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Созвон по проекту" }));
    expect(opened).toBe(0);
  });

  it("is offered on a compact card too", async () => {
    calendar([weekly]);
    await screen.findByTestId("task-card-task-1");

    for (let step = 0; step < 4; step++) {
      await userEvent.click(screen.getByRole("button", { name: "Уменьшить масштаб" }));
    }

    const compact = screen.getByTestId("task-card-task-1");
    expect(compact).toHaveAttribute("data-compact", "true");
    expect(within(compact).getByRole("checkbox", { name: "Готово: Созвон по проекту" })).toBeInTheDocument();
  });

  it("puts the call back and says so when the server refuses", async () => {
    server.use(mock.post("/api/tasks/task-1/complete", () =>
      HttpResponse.json({ error: { message: "нельзя" } }, { status: 403 })));
    calendar([weekly]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Созвон по проекту" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось перенести задачу");
    const wednesday = screen.getByRole("group", { name: /среда/ });
    expect(within(wednesday).getByText("Созвон по проекту")).toBeInTheDocument();
  });

  it("offers a guest no checkbox", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Guest", email: "g@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "GUEST",
      clientIds: [],
    })));
    calendar([weekly]);

    await screen.findByText("Созвон по проекту");
    await waitFor(() => expect(screen.queryByRole("checkbox")).not.toBeInTheDocument());
  });
});
