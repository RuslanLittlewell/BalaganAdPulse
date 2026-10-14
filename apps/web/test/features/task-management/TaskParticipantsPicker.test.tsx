import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import type { Task } from "@/entities/task/index.js";

const staff = [
  { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

const customer = { ...staff[0], id: "customer-1", userId: "u9", name: "Ольга", email: "o@client.com", role: "CLIENT" };

let sent: Record<string, unknown> | null = null;

beforeEach(() => {
  sent = null;
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "project-1", clientId: "client-1", name: "Сайт" }),
      aProject({ id: "project-2", clientId: "client-2", name: "Чужой" }),
    ])),
    mock.get("/api/members", ({ request }) => {
      const query = new URL(request.url).searchParams;
      if (query.get("clientId") === "client-1" && query.get("projectId") === "project-1") {
        return HttpResponse.json([customer]);
      }
      if (query.get("clientId")) return HttpResponse.json([]);
      return HttpResponse.json(staff);
    }),
    mock.patch("/api/tasks/:id", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json(aTask());
    }),
  );
});

function edit(task: Partial<Task>) {
  renderWithProviders(<TaskFormDialog task={aTask(task)} onClose={() => {}} />, { route: "/tasks" });
}

const picker = () => screen.findByRole("button", { name: "Участники" });

describe("the people a task's participants are picked from", () => {
  it("are the staff and the client's people who reach the task's project", async () => {
    const user = userEvent.setup();
    edit({ projectId: "project-1", participantIds: ["member-1"] });

    await user.click(await picker());

    expect(await screen.findByRole("menuitemcheckbox", { name: "Ольга" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "Пётр" })).toBeInTheDocument();
    expect(screen.getByText("Люди клиента увидят задачу, только если она видна клиенту")).toBeInTheDocument();
  });

  it("are the staff alone on a task with no project", async () => {
    const user = userEvent.setup();
    edit({ projectId: null, participantIds: ["member-1"] });

    await user.click(await picker());

    expect(await screen.findByRole("menuitemcheckbox", { name: "Пётр" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox", { name: "Ольга" })).toBeNull();
  });

  it("include the client's person once chosen", async () => {
    const user = userEvent.setup();
    edit({ projectId: "project-1", participantIds: ["member-1"] });

    await user.click(await picker());
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Ольга" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(sent).toMatchObject({ participantIds: ["member-1", "customer-1"] }));
  });

  it("lose the client's person when the task moves to another client's project", async () => {
    const user = userEvent.setup();
    edit({ projectId: "project-1", participantIds: ["member-1", "customer-1"] });
    await waitFor(async () => expect(await picker()).toHaveTextContent("+1"));

    await user.click(screen.getByLabelText("Проект"));
    await user.click(await screen.findByRole("option", { name: /Чужой/ }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(sent).toMatchObject({ projectId: "project-2", participantIds: ["member-1"] }));
  });
});
