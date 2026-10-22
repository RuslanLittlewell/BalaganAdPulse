import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { ArchivePage } from "@/pages/archive/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";

const members = [
  { id: "m1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "m2", userId: "u2", name: "Анна", email: "a@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const tasks = [
  aTask({ id: "old", title: "Старый бриф", column: "ARCHIVED", archivedAt: daysAgo(20), projectId: "p1", participantIds: ["m1"] }),
  aTask({ id: "older", title: "Давний отчёт", column: "ARCHIVED", archivedAt: daysAgo(40), projectId: "p2", participantIds: ["m2"] }),
  aTask({ id: "week", title: "Недельный макет", column: "ARCHIVED", archivedAt: daysAgo(7), projectId: "p1", participantIds: ["m2"] }),
  aTask({ id: "fresh", title: "Свежий архив", column: "ARCHIVED", archivedAt: daysAgo(2), projectId: "p1", participantIds: ["m1"] }),
  aTask({ id: "live", title: "Живая задача", column: "IN_PROGRESS", projectId: "p1", participantIds: ["m1"] }),
];

function serve(list = tasks) {
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "p1", name: "Сайт" }),
      aProject({ id: "p2", name: "Магазин" }),
    ])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/tasks", () => HttpResponse.json(list)),
  );
}

beforeEach(() => {
  useModuleMemory.setState({
    taskParticipants: {}, taskProjects: {}, archiveParticipants: {}, archiveProjects: {},
  });
  serve();
});

const titles = () =>
  screen.queryAllByRole("listitem", { hidden: true })
    .map((item) => item.querySelector("button > span")?.textContent);

describe("the archive module", () => {
  it("lists the tasks archived for a week or more, the latest archived first", async () => {
    renderWithProviders(<ArchivePage />, { route: "/archive" });

    await screen.findByText("Недельный макет");

    expect(titles()).toEqual(["Недельный макет", "Старый бриф", "Давний отчёт"]);
    expect(screen.queryByText("Свежий архив")).not.toBeInTheDocument();
    expect(screen.queryByText("Живая задача")).not.toBeInTheDocument();
  });

  it("says the archive is empty when nothing is shelved", async () => {
    serve([tasks[3], tasks[4]]);
    renderWithProviders(<ArchivePage />, { route: "/archive" });

    expect(await screen.findByText("В архиве пока пусто")).toBeInTheDocument();
  });

  it("narrows the list to a chosen project", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArchivePage />, { route: "/archive" });
    await screen.findByText("Старый бриф");

    await user.click(screen.getByRole("button", { name: "Фильтр по проектам" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Магазин" }));

    await waitFor(() => expect(titles()).toEqual(["Давний отчёт"]));
  });

  it("narrows the list to a chosen participant", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArchivePage />, { route: "/archive" });
    await screen.findByText("Старый бриф");

    await user.click(screen.getByRole("button", { name: "Фильтр по участникам" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Пётр" }));

    await waitFor(() => expect(titles()).toEqual(["Старый бриф"]));
  });

  it("keeps its filters apart from the tasks page's", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArchivePage />, { route: "/archive" });
    await screen.findByText("Старый бриф");

    await user.click(screen.getByRole("button", { name: "Фильтр по проектам" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Магазин" }));

    expect(useModuleMemory.getState().taskProjects).toEqual({});
  });
});

describe("a task opened from the archive", () => {
  it("is named in the address, and a shared address opens it", async () => {
    renderWithProviders(<ArchivePage />, { route: "/archive?task=old" });

    expect(await screen.findByLabelText("Название")).toHaveValue("Старый бриф");
  });
});

describe("the task board next to the archive", () => {
  it("no longer shows a task shelved in the archive, but keeps a recent one", async () => {
    renderWithProviders(<TasksPage />, { route: "/tasks" });

    await screen.findByText("Свежий архив");

    expect(screen.queryByText("Старый бриф")).not.toBeInTheDocument();
    expect(screen.queryByText("Недельный макет")).not.toBeInTheDocument();
    expect(screen.getByText("Живая задача")).toBeInTheDocument();
  });
});
