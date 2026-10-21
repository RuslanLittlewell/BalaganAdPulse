import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";

const members = [
  { id: "m1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "m2", userId: "u2", name: "Анна", email: "a@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

const today = new Date().toISOString().slice(0, 10);

const board = [
  aTask({ id: "t1", title: "Сайт у Петра", projectId: "p1", participantIds: ["m1"], dueDate: today }),
  aTask({ id: "t2", title: "Сайт у Анны", projectId: "p1", participantIds: ["m2"], dueDate: today }),
  aTask({ id: "t3", title: "Магазин у Петра", projectId: "p2", participantIds: ["m1"], dueDate: today }),
  aTask({ id: "t4", title: "Своя заметка", projectId: null, participantIds: ["m1"], dueDate: today }),
];

const TITLES = board.map((task) => task.title);

function serve() {
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "p1", name: "Сайт" }),
      aProject({ id: "p2", name: "Магазин" }),
      aProject({ id: "p3", name: "Лендинг" }),
    ])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/tasks", () => HttpResponse.json(board)),
  );
}

beforeEach(() => {
  useModuleMemory.setState({ taskViews: {}, taskParticipants: {}, taskProjects: {} });
  serve();
});

const setup = () => renderWithProviders(<TasksPage />, { route: "/tasks" });

const projectFilter = () => screen.getByRole("button", { name: "Фильтр по проектам" });
const assigneeFilter = () => screen.getByRole("button", { name: "Фильтр по участникам" });
const choose = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(await screen.findByRole("menuitemcheckbox", { name }));

const shown = () => TITLES.filter((title) => screen.queryByText(title) !== null);

describe("narrowing the task module to chosen projects", () => {
  it("shows every task while no project is chosen", async () => {
    setup();
    await screen.findByText("Сайт у Петра");

    expect(shown()).toEqual(TITLES);
  });

  it("shows one chosen project's tasks alone", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(projectFilter());
    await choose(user, "Сайт");

    await waitFor(() => expect(shown()).toEqual(["Сайт у Петра", "Сайт у Анны"]));
  });

  it("shows the tasks of every chosen project", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(projectFilter());
    await choose(user, "Сайт");
    await choose(user, "Магазин");

    await waitFor(() => expect(shown()).toEqual(["Сайт у Петра", "Сайт у Анны", "Магазин у Петра"]));
  });

  it("picks out the tasks with no project", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Своя заметка");

    await user.click(projectFilter());
    await choose(user, "Без проекта");

    await waitFor(() => expect(shown()).toEqual(["Своя заметка"]));
  });

  it("lists the projects whose tasks are on the board, and no other", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(projectFilter());

    const offered = await screen.findAllByRole("menuitemcheckbox");
    expect(offered).toHaveLength(4);
    expect(offered[0]).toHaveAccessibleName("Все");
    expect(offered[1]).toHaveAccessibleName("Магазин");
    expect(offered[2]).toHaveAccessibleName("Сайт");
    expect(offered[3]).toHaveAccessibleName("Без проекта");
  });

  it("chooses every project at once with Все", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(projectFilter());
    await choose(user, "Все");

    for (const item of await screen.findAllByRole("menuitemcheckbox")) {
      expect(item).toHaveAttribute("aria-checked", "true");
    }
  });

  it("combines with the responsible-member filter", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(projectFilter());
    await choose(user, "Сайт");
    await user.keyboard("{Escape}");
    await user.click(assigneeFilter());
    await choose(user, "Анна");

    await waitFor(() => expect(shown()).toEqual(["Сайт у Анны"]));
  });

  it("narrows the calendar by the same choice", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(projectFilter());
    await choose(user, "Магазин");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("radio", { name: "Календарь" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Следующая неделя" })).toBeInTheDocument());
    expect(shown()).toEqual(["Магазин у Петра"]);
    expect(projectFilter()).toHaveTextContent("Магазин");
  });
});

describe("remembering the chosen projects", () => {
  it("keeps the choice for the member who made it", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(projectFilter());
    await choose(user, "Магазин");

    await waitFor(() =>
      expect(useModuleMemory.getState().taskProjects["user-1"]).toEqual(["p2"]));
  });

  it("opens the module on the projects it was left with", async () => {
    useModuleMemory.setState({ taskViews: {}, taskParticipants: {}, taskProjects: { "user-1": ["p2"] } });
    setup();

    await screen.findByText("Магазин у Петра");
    await waitFor(() => expect(shown()).toEqual(["Магазин у Петра"]));
  });

  it("keeps a chosen project listed after its last task is gone", async () => {
    const user = userEvent.setup();
    useModuleMemory.setState({ taskViews: {}, taskParticipants: {}, taskProjects: { "user-1": ["p3"] } });
    setup();

    await waitFor(() => expect(projectFilter()).toHaveTextContent("Лендинг"));
    await user.click(projectFilter());
    await choose(user, "Лендинг");

    await waitFor(() => expect(shown()).toEqual(TITLES));
  });

  it("leaves another member's choice alone", async () => {
    useModuleMemory.setState({ taskViews: {}, taskParticipants: {}, taskProjects: { "somebody-else": ["p2"] } });
    setup();

    await screen.findByText("Сайт у Петра");
    expect(shown()).toEqual(TITLES);
  });
});
