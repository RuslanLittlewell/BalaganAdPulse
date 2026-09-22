import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, realtime, renderWithProviders, server } from "@test/shared/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { ProjectsSync } from "@/entities/project/index.js";

const project = aProject({ id: "project-1", name: "Летний запуск" });

const counts = { projects: 0, tasks: 0, names: 0, projectNames: 0 };

let connections = 0;

beforeEach(() => {
  counts.projects = 0;
  counts.tasks = 0;
  counts.names = 0;
  counts.projectNames = 0;
  connections = 0;
  server.use(
    realtime.addEventListener("connection", () => { connections += 1; }),
    mock.get("/api/projects", () => {
      counts.projects += 1;
      return HttpResponse.json([project]);
    }),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", () => {
      counts.tasks += 1;
      return HttpResponse.json([aTask({ projectId: "project-1", title: "Написать бриф" })]);
    }),
    mock.get("/api/campaigns/names", () => {
      counts.names += 1;
      return HttpResponse.json([]);
    }),
    mock.get("/api/projects/:projectId/campaigns/names", () => {
      counts.projectNames += 1;
      return HttpResponse.json([]);
    }),
  );
});

const openModule = () =>
  renderWithProviders(<><ProjectsSync /><TasksPage /></>, { route: "/tasks" });

describe("what the task module asks the server for", () => {
  it("asks for the tasks and the campaign names once, and never per project", async () => {
    openModule();
    await screen.findByText("Написать бриф");

    expect(counts.tasks).toBe(1);
    expect(counts.names).toBe(1);
    expect(counts.projectNames).toBe(0);
  });

  it("asks for nothing when a task card is opened", async () => {
    openModule();
    await userEvent.click(await screen.findByText("Написать бриф"));
    await screen.findByLabelText("Название");

    expect(counts.projects).toBe(1);
    expect(counts.tasks).toBe(1);
    expect(counts.names).toBe(1);
    expect(counts.projectNames).toBe(0);
  });

  it("asks for nothing when the view is switched", async () => {
    openModule();
    await screen.findByText("Написать бриф");
    const before = { ...counts };

    await userEvent.click(screen.getByRole("radio", { name: "Календарь" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Следующая неделя" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("radio", { name: "Канбан" }));
    await screen.findByRole("heading", { name: "Идея", level: 2 });

    expect(counts).toEqual(before);
  });

  it("keeps the realtime connection it already has when the view is switched", async () => {
    openModule();
    await screen.findByText("Написать бриф");
    await waitFor(() => expect(connections).toBe(1));

    await userEvent.click(screen.getByRole("radio", { name: "Календарь" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Следующая неделя" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("radio", { name: "Канбан" }));
    await screen.findByRole("heading", { name: "Идея", level: 2 });

    expect(connections).toBe(1);
  });

  it("leaves the project list to the one the app loaded at start", async () => {
    openModule();
    await screen.findByText("Написать бриф");
    await userEvent.click(screen.getByText("Написать бриф"));
    await screen.findByLabelText("Название");

    expect(counts.projects).toBe(1);
  });
});
