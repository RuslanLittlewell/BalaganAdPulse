import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { toIso } from "@/shared/ui/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";

const members = [
  { id: "m1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "m2", userId: "u2", name: "Анна", email: "a@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

const today = toIso(new Date());

const board = [
  aTask({ id: "t1", title: "Сайт у Петра", projectId: "p1", participantIds: ["m1"], dueDate: today }),
  aTask({ id: "t2", title: "Сайт у Анны", projectId: "p1", participantIds: ["m2"], dueDate: today }),
  aTask({ id: "t3", title: "Магазин у Петра", projectId: "p2", participantIds: ["m1"], dueDate: today }),
];

const TITLES = board.map((task) => task.title);

beforeEach(() => {
  useModuleMemory.setState({ taskViews: {}, taskParticipants: {}, taskProjects: {} });
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "p1", name: "Сайт" }),
      aProject({ id: "p2", name: "Магазин" }),
    ])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/tasks", () => HttpResponse.json(board)),
  );
});

const setup = () => renderWithProviders(<TasksPage />, { route: "/tasks" });

const shown = () => TITLES.filter((title) => screen.queryByText(title) !== null);

describe("the task filters behind a button", () => {
  it("opens both filters from the button", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(screen.getByRole("button", { name: "Фильтры" }));

    const filters = await screen.findByRole("dialog", { name: "Фильтры" });
    expect(within(filters).getByRole("button", { name: "Фильтр по участникам" })).toBeInTheDocument();
    expect(within(filters).getByRole("button", { name: "Фильтр по проектам" })).toBeInTheDocument();
  });

  it("narrows the tasks from the opened filters and keeps them open", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Сайт у Петра");

    await user.click(screen.getByRole("button", { name: "Фильтры" }));
    const filters = await screen.findByRole("dialog", { name: "Фильтры" });
    await user.click(within(filters).getByRole("button", { name: "Фильтр по проектам" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Магазин" }));

    await waitFor(() => expect(shown()).toEqual(["Магазин у Петра"]));
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("dialog", { name: "Фильтры" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("names how many choices are active", async () => {
    useModuleMemory.setState({
      taskViews: {},
      taskParticipants: { "user-1": ["m1"] },
      taskProjects: { "user-1": ["p1"] },
    });
    setup();

    expect(await screen.findByRole("button", { name: "Фильтры, выбрано: 2" })).toBeInTheDocument();
  });
});
