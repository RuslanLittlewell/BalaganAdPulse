import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TasksPage } from "@/pages/tasks/index.js";

function setup() {
  return renderWithProviders(<TasksPage />, { route: "/tasks" });
}

const guestSession = {
  user: { id: "user-1", name: "Guest", email: "g@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "GUEST",
  clientIds: [],
};

beforeEach(() => {
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1", name: "Летний запуск" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
  );
});

describe("TasksPage", () => {
  it("replaces the placeholder with a real board", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([aTask({ title: "Написать бриф" })])));
    setup();

    expect(await screen.findByRole("heading", { name: "Задачи", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText("Написать бриф")).toBeInTheDocument();
    expect(screen.queryByText("Модуль в разработке")).not.toBeInTheDocument();
  });

  it("offers the create button to a member who may write", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    setup();
    expect(await screen.findByRole("button", { name: "Новая задача" })).toBeInTheDocument();
  });

  it("hides the create button from a guest", async () => {
    server.use(
      mock.get("/api/auth/me", () => HttpResponse.json(guestSession)),
      mock.get("/api/tasks", () => HttpResponse.json([])),
    );
    setup();

    await screen.findByRole("heading", { name: "Задачи", level: 1 });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Новая задача" })).not.toBeInTheDocument());
  });

  it("opens the create dialog", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Новая задача" }));
    expect(await screen.findByLabelText("Название")).toBeInTheDocument();
  });

  it("opens the task from anywhere on the card, not just its title", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      aTask({ title: "Написать бриф", priority: "URGENT" }),
    ])));
    setup();

    await userEvent.click(await screen.findByText("Срочный"));
    expect(await screen.findByLabelText("Название")).toHaveValue("Написать бриф");
  });

  it("opens a card for editing, with its values filled in", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      aTask({ title: "Написать бриф", priority: "HIGH" }),
    ])));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Открыть задачу: Написать бриф" }));
    expect(await screen.findByLabelText("Название")).toHaveValue("Написать бриф");
  });

  it("asks before deleting, and deletes only once confirmed", async () => {
    let deleted = false;
    server.use(
      mock.get("/api/tasks", () => HttpResponse.json([aTask({ title: "Написать бриф" })])),
      mock.delete("/api/tasks/task-1", () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
    );
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Открыть задачу: Написать бриф" }));
    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));

    expect(await screen.findByText("Удалить задачу?")).toBeInTheDocument();
    expect(deleted).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Удалить задачу" }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it("keeps the task when the confirmation is dismissed", async () => {
    let deleted = false;
    server.use(
      mock.get("/api/tasks", () => HttpResponse.json([aTask({ title: "Написать бриф" })])),
      mock.delete("/api/tasks/task-1", () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
    );
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Открыть задачу: Написать бриф" }));
    await userEvent.click(await screen.findByRole("button", { name: "Удалить" }));
    await screen.findByText("Удалить задачу?");
    await userEvent.keyboard("{Escape}");

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(deleted).toBe(false);
  });
});
