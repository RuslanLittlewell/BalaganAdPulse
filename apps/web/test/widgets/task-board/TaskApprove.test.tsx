import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { LoadedTaskBoard as TaskBoard } from "@test/shared/task-widgets.js";
import type { Task } from "@/entities/task/index.js";

function board(tasks: Task[]) {
  server.use(mock.get("/api/tasks", () => HttpResponse.json(tasks)));
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskBoard />} /></Routes>,
    { route: "/tasks" },
  );
}

function signedInAs(role: string) {
  server.use(mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Member", email: "m@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    clientIds: [],
  })));
}

const titlesIn = (name: string) =>
  [...screen.getByLabelText(name).querySelectorAll("article h3")].map((node) => node.textContent);

describe("approving a done task into the archive", () => {
  it("moves the task to the top of Архив when an admin approves it", async () => {
    signedInAs("ADMIN");
    let body: unknown = null;
    server.use(mock.post("/api/tasks/task-1/move", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(aTask({ column: "ARCHIVED", position: 0, archivedAt: "2026-11-16T10:00:00.000Z" }));
    }));
    board([
      aTask({ column: "DONE" }),
      aTask({ id: "task-2", title: "Старое", column: "ARCHIVED", position: 0, archivedAt: "2026-11-15T10:00:00.000Z" }),
    ]);

    await userEvent.click(await screen.findByRole("button", { name: "В архив: Написать бриф" }));

    await waitFor(() => expect(body).toEqual({ column: "ARCHIVED", position: 0 }));
    await waitFor(() => expect(titlesIn("Архив")).toEqual(["Написать бриф", "Старое"]));
    expect(titlesIn("Готово")).toEqual([]);
  });

  it("offers the approval on done cards only", async () => {
    signedInAs("ADMIN");
    board([
      aTask({ column: "DONE" }),
      aTask({ id: "task-2", title: "Сверстать", column: "IN_REVIEW" }),
    ]);

    await screen.findByRole("button", { name: "В архив: Написать бриф" });
    expect(within(screen.getByLabelText("На проверке")).queryByRole("button", { name: /^В архив/ }))
      .not.toBeInTheDocument();
  });

  it("offers a manager no approval", async () => {
    signedInAs("MANAGER");
    board([aTask({ column: "DONE" })]);

    await screen.findByTestId("task-drag-task-1");
    expect(screen.queryByRole("button", { name: /^В архив/ })).not.toBeInTheDocument();
  });

  it("tells the admin when the approval was refused and keeps the task in Готово", async () => {
    signedInAs("ADMIN");
    server.use(mock.post("/api/tasks/task-1/move", () =>
      HttpResponse.json({ error: { message: "no" } }, { status: 403 })));
    board([aTask({ column: "DONE" })]);

    await userEvent.click(await screen.findByRole("button", { name: "В архив: Написать бриф" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось переместить задачу");
    await waitFor(() => expect(titlesIn("Готово")).toEqual(["Написать бриф"]));
  });
});
