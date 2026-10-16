import { http as mock, HttpResponse, delay } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { ACTIVE_TASK_COLUMNS, useTasks } from "@/entities/task/index.js";
import { TaskList } from "@/widgets/task-list/index.js";

function WorkInFlight() {
  const { data } = useTasks({ projectId: "project-1" });
  const inFlight = (data ?? []).filter((task) => ACTIVE_TASK_COLUMNS.includes(task.column));
  return <TaskList title="Задачи в работе" tasks={inFlight} onOpen={() => {}} />;
}

function project(tasks: unknown[]) {
  server.use(mock.get("/api/tasks", () => HttpResponse.json(tasks)));
  return renderWithProviders(<WorkInFlight />, { route: "/projects/project-1" });
}

describe("closing a task from a project's work in flight", () => {
  it("moves it to Готово, so it leaves the list before the server answers", async () => {
    let body: unknown = null;
    server.use(mock.post("/api/tasks/task-1/move", async ({ request }) => {
      body = await request.json();
      await delay(200);
      return HttpResponse.json(aTask({ column: "DONE", position: 0 }));
    }));
    project([
      aTask({ column: "IN_PROGRESS" }),
      aTask({ id: "task-2", title: "Сверстать", column: "IDEA" }),
    ]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Написать бриф" }));

    expect(screen.queryByText("Написать бриф")).not.toBeInTheDocument();
    expect(screen.getByText("Сверстать")).toBeInTheDocument();
    await waitFor(() => expect(body).toEqual({ column: "DONE", position: 0 }));
  });

  it("brings it back and says so when the server refuses", async () => {
    server.use(mock.post("/api/tasks/task-1/move", () =>
      HttpResponse.json({ error: { message: "нельзя" } }, { status: 403 })));
    project([aTask({ column: "IN_PROGRESS" })]);

    await userEvent.click(await screen.findByRole("checkbox", { name: "Готово: Написать бриф" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось отметить задачу");
    expect(screen.getByText("Написать бриф")).toBeInTheDocument();
  });

  it("offers a guest no checkbox", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Guest", email: "g@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "GUEST",
      clientIds: [],
    })));
    project([aTask({ column: "IN_PROGRESS" })]);

    await screen.findByText("Написать бриф");
    await waitFor(() => expect(screen.queryByRole("checkbox")).not.toBeInTheDocument());
  });
});
