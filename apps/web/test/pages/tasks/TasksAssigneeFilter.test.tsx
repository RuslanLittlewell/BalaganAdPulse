import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
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
  aTask({ id: "t1", title: "Пишет Пётр", assigneeId: "m1", dueDate: today }),
  aTask({ id: "t2", title: "Пишет Анна", assigneeId: "m2", dueDate: today }),
  aTask({ id: "t3", title: "Ничей", assigneeId: null, dueDate: today }),
];

function serve(tasks = board) {
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/tasks", () => HttpResponse.json(tasks)),
  );
}

beforeEach(() => {
  useModuleMemory.setState({ taskViews: {}, taskAssignees: {} });
  serve();
});

const setup = () => renderWithProviders(<TasksPage />, { route: "/tasks" });

const filter = () => screen.getByRole("button", { name: "Фильтр по ответственным" });
const openFilter = async (user: ReturnType<typeof userEvent.setup>) => user.click(filter());
const choose = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(await screen.findByRole("menuitemcheckbox", { name }));

const shown = () =>
  ["Пишет Пётр", "Пишет Анна", "Ничей"].filter((title) => screen.queryByText(title) !== null);

describe("narrowing the task module to chosen members", () => {
  it("offers the filter in the module's header", async () => {
    setup();
    await screen.findByText("Пишет Пётр");

    expect(filter()).toBeInTheDocument();
  });

  it("shows every task while nobody is chosen", async () => {
    setup();
    await screen.findByText("Пишет Пётр");

    expect(shown()).toEqual(["Пишет Пётр", "Пишет Анна", "Ничей"]);
  });

  it("shows one chosen member's work alone", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Пишет Пётр");

    await openFilter(user);
    await choose(user, "Пётр");

    await waitFor(() => expect(shown()).toEqual(["Пишет Пётр"]));
  });

  it("shows the work of everyone chosen", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Пишет Пётр");

    await openFilter(user);
    await choose(user, "Пётр");
    await choose(user, "Анна");

    await waitFor(() => expect(shown()).toEqual(["Пишет Пётр", "Пишет Анна"]));
  });

  it("shows everything again once the last chosen member is unchosen", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Пишет Пётр");

    await openFilter(user);
    await choose(user, "Пётр");
    await waitFor(() => expect(shown()).toEqual(["Пишет Пётр"]));
    await choose(user, "Пётр");

    await waitFor(() => expect(shown()).toEqual(["Пишет Пётр", "Пишет Анна", "Ничей"]));
  });

  it("picks out the work nobody holds", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Ничей");

    await openFilter(user);
    await choose(user, "Не назначен");

    await waitFor(() => expect(shown()).toEqual(["Ничей"]));
  });

  it("lists the members whose work is on the board, and nobody else", async () => {
    const user = userEvent.setup();
    serve([aTask({ id: "t1", title: "Пишет Пётр", assigneeId: "m1" })]);
    setup();
    await screen.findByText("Пишет Пётр");

    await openFilter(user);

    expect(await screen.findByRole("menuitemcheckbox", { name: "Пётр" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox", { name: "Анна" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitemcheckbox", { name: "Не назначен" })).not.toBeInTheDocument();
  });
});

describe("the filter belongs to the module, not to one of its views", () => {
  it("narrows the calendar by the same choice", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Пишет Пётр");

    await openFilter(user);
    await choose(user, "Пётр");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("radio", { name: "Календарь" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Следующая неделя" })).toBeInTheDocument());
    expect(shown()).toEqual(["Пишет Пётр"]);
  });

  it("keeps the choice while the views are switched", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Пишет Пётр");

    await openFilter(user);
    await choose(user, "Пётр");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("radio", { name: "Календарь" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Следующая неделя" })).toBeInTheDocument());
    await user.click(screen.getByRole("radio", { name: "Канбан" }));
    await screen.findByRole("heading", { name: "Идея", level: 2 });

    expect(filter()).toHaveTextContent("Пётр");
    expect(shown()).toEqual(["Пишет Пётр"]);
  });
});

describe("the filter cannot widen what a member sees", () => {
  it("offers a manager only the people their own board already carries", async () => {
    const user = userEvent.setup();
    serve([aTask({ id: "t1", title: "Пишет Пётр", assigneeId: "m1" })]);
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "u1", name: "Пётр", email: "p@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "MANAGER",
      clientIds: [],
    })));
    setup();
    await screen.findByText("Пишет Пётр");

    await openFilter(user);

    expect(await screen.findByRole("menuitemcheckbox", { name: "Пётр" })).toBeInTheDocument();
    expect(await screen.findAllByRole("menuitemcheckbox")).toHaveLength(1);
  });
});

describe("remembering whose work was chosen", () => {
  it("keeps the choice for the member who made it", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText("Пишет Пётр");

    await openFilter(user);
    await choose(user, "Пётр");

    await waitFor(() =>
      expect(useModuleMemory.getState().taskAssignees["user-1"]).toEqual(["m1"]));
  });

  it("opens the module on the filter it was left with", async () => {
    useModuleMemory.setState({ taskViews: {}, taskAssignees: { "user-1": ["m2"] } });
    setup();

    await screen.findByText("Пишет Анна");
    await waitFor(() => expect(shown()).toEqual(["Пишет Анна"]));
  });

  it("leaves another member's filter alone", async () => {
    useModuleMemory.setState({ taskViews: {}, taskAssignees: { "somebody-else": ["m2"] } });
    setup();

    await screen.findByText("Пишет Пётр");
    expect(shown()).toEqual(["Пишет Пётр", "Пишет Анна", "Ничей"]);
  });
});
