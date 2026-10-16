import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import type { Task } from "@/entities/task/index.js";

const manager = {
  user: { id: "user-1", name: "Менеджер", email: "m@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "MANAGER",
  clientIds: [],
};

beforeEach(() => {
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.patch("/api/tasks/:id", () => HttpResponse.json(aTask())),
  );
});

function edit(task: Partial<Task> = {}) {
  const existing = aTask({ projectId: "project-1", ...task });
  return renderWithProviders(
    <TaskFormDialog task={existing} onClose={() => {}} />, { route: "/tasks" },
  );
}

describe("whether a task is shown to the client", () => {
  it("sits in the dialog's footer", async () => {
    edit();
    const footer = await screen.findByTestId("task-form-footer");
    expect(within(footer).getByRole("switch", { name: "Видно клиенту" })).toBeInTheDocument();
  });

  it("is not offered in the row of blocks", async () => {
    edit();
    await screen.findByLabelText("Название");
    expect(screen.queryByRole("button", { name: "Видно клиенту" })).not.toBeInTheDocument();
  });

  it("is absent while the task has no project", async () => {
    edit({ projectId: null });
    await screen.findByLabelText("Название");
    expect(screen.queryByRole("switch", { name: "Видно клиенту" })).not.toBeInTheDocument();
  });

  it("is absent for a member who may not change it", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json(manager)));
    edit();

    await screen.findByLabelText("Название");
    await waitFor(() =>
      expect(screen.queryByRole("switch", { name: "Видно клиенту" })).not.toBeInTheDocument());
  });
});
