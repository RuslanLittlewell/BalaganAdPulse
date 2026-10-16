import { http as mock, HttpResponse, delay } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const column = (name: string) => screen.getByRole("region", { name });
const titlesIn = (name: string) =>
  [...column(name).querySelectorAll("article h3")].map((node) => node.textContent);

describe("closing and reopening a task from the board", () => {
  it("moves a task to the top of Готово before the server answers", async () => {
    let body: unknown = null;
    server.use(mock.post("/api/tasks/task-2/move", async ({ request }) => {
      body = await request.json();
      await delay(200);
      return HttpResponse.json(aTask({ id: "task-2", title: "Сверстать", column: "DONE", position: 0 }));
    }));
    board([
      aTask({ id: "task-1", title: "Написать бриф", column: "IN_PROGRESS", position: 0 }),
      aTask({ id: "task-2", title: "Сверстать", column: "IN_PROGRESS", position: 1 }),
      aTask({ id: "task-3", title: "Отчёт", column: "IN_PROGRESS", position: 2 }),
      aTask({ id: "task-4", title: "Старое", column: "DONE", position: 0 }),
    ]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Сверстать" }));

    expect(titlesIn("Готово")).toEqual(["Сверстать", "Старое"]);
    expect(titlesIn("В работе")).toEqual(["Написать бриф", "Отчёт"]);
    expect(screen.getByRole("checkbox", { name: "Готово: Сверстать" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(body).toEqual({ column: "DONE", position: 0 }));
  });

  it("reopens a task from Готово into the top of В работе", async () => {
    let body: unknown = null;
    server.use(mock.post("/api/tasks/task-1/move", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(aTask({ column: "IN_PROGRESS", position: 0 }));
    }));
    board([
      aTask({ column: "DONE" }),
      aTask({ id: "task-2", title: "Сверстать", column: "IN_PROGRESS", position: 0 }),
    ]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Написать бриф" }));

    expect(titlesIn("В работе")).toEqual(["Написать бриф", "Сверстать"]);
    await waitFor(() => expect(body).toEqual({ column: "IN_PROGRESS", position: 0 }));
    expect(screen.getByRole("checkbox", { name: "Готово: Написать бриф" })).toHaveAttribute("aria-checked", "false");
  });

  it("completes a repeating task instead of closing it", async () => {
    let completed = false;
    let moved = false;
    const weekly = aTask({ column: "IN_PROGRESS", dueDate: "2026-09-16", repeatEvery: "WEEKLY" });
    server.use(
      mock.post("/api/tasks/task-1/complete", () => {
        completed = true;
        return HttpResponse.json({ ...weekly, dueDate: "2026-09-23" });
      }),
      mock.post("/api/tasks/task-1/move", () => {
        moved = true;
        return HttpResponse.json(weekly);
      }),
    );
    board([weekly]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Написать бриф" }));

    await waitFor(() => expect(completed).toBe(true));
    expect(moved).toBe(false);
    expect(titlesIn("В работе")).toEqual(["Написать бриф"]);
    expect(within(column("В работе")).getByText(/23\.09/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Готово: Написать бриф" })).toHaveAttribute("aria-checked", "false");
  });

  it("puts the card back and says so when the server refuses", async () => {
    server.use(mock.post("/api/tasks/task-1/move", () =>
      HttpResponse.json({ error: { message: "нельзя" } }, { status: 403 })));
    board([aTask({ column: "IN_PROGRESS" })]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Написать бриф" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось отметить задачу");
    expect(titlesIn("В работе")).toEqual(["Написать бриф"]);
    expect(titlesIn("Готово")).toEqual([]);
  });

  it("offers a guest no checkbox", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Guest", email: "g@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "GUEST",
      clientIds: [],
    })));
    board([aTask({ column: "IN_PROGRESS" })]);

    await screen.findByText("Написать бриф");
    await waitFor(() => expect(screen.queryByRole("checkbox")).not.toBeInTheDocument());
  });
});
