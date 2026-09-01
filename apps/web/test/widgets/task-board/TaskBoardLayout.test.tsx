import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskBoard } from "@/widgets/task-board/index.js";
import { TaskColumnPanel } from "@/widgets/task-board/TaskColumn.js";
import { TaskCard } from "@/widgets/task-board/TaskCard.js";

function board() {
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskBoard />} /></Routes>,
    { route: "/tasks" },
  );
}

/** Layout guards. The requirement is visual — the columns run the full height of
 * the board rather than shrinking to their contents — so these assert the
 * structure that produces it, which is the closest jsdom can get. */
describe("the board fills its height", () => {
  it("gives every column the full height and its own scroll", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    board();

    const column = await screen.findByTestId("task-column-IDEA");
    expect(column.className).toContain("h-full");
    expect(column.className).toContain("min-h-0");

    // The cards scroll inside the column, so a long one never stretches the page.
    const list = column.querySelector(".overflow-y-auto");
    expect(list).not.toBeNull();
    expect(list!.className).toContain("flex-1");
  });

  it("lays the columns out in a row that fills the board and scrolls sideways", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    board();

    const row = (await screen.findByTestId("task-column-IDEA")).parentElement!;
    expect(row.className).toContain("h-full");
    expect(row.className).toContain("overflow-x-auto");
  });
});

describe("how the board is drawn", () => {
  it("gives every column a header with its name, a colour and a count", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([aTask({ column: "IN_PROGRESS" })])));
    board();

    const column = await screen.findByTestId("task-column-IN_PROGRESS");
    const header = column.querySelector("header")!;
    expect(header).not.toBeNull();
    expect(header.textContent).toContain("В работе");
    expect(header.textContent).toContain("1");
    // The header is separated from the cards rather than floating above them.
    expect(header.className).toContain("border-b");
  });

  it("draws each column as a bordered, shadowed panel", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    board();

    const column = await screen.findByTestId("task-column-IDEA");
    expect(column.className).toContain("border");
    expect(column.className).toContain("shadow-sm");
    expect(column.className).toContain("rounded-xl");
  });

  it("draws each card as a bordered, shadowed tile that lifts on hover", () => {
    renderWithProviders(<TaskCard task={aTask()} draggable={false} />, { route: "/tasks" });
    const card = screen.getByTestId("task-card-task-1");
    expect(card.className).toContain("border");
    expect(card.className).toContain("shadow-sm");
    expect(card.className).toContain("hover:shadow-md");
  });

  it("tells an empty column it is empty, so it is still a target worth aiming at", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    board();

    const column = await screen.findByTestId("task-column-DONE");
    expect(column.textContent).toContain("Задач пока нет");
  });
});

describe("the card left behind while dragging", () => {
  it("stays in place as a placeholder rather than vanishing", () => {
    renderWithProviders(
      <TaskCard task={aTask({ title: "В воздухе" })} draggable placeholder />,
      { route: "/tasks" },
    );

    const card = screen.getByTestId("task-card-task-1");
    // Present, marked, and still occupying its slot — a removed card would
    // close the gap the drop is aiming at.
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("data-placeholder", "true");
    expect(card.className).toContain("border-dashed");
  });

  it("is an ordinary card when nothing is being dragged", () => {
    renderWithProviders(<TaskCard task={aTask()} draggable />, { route: "/tasks" });
    const card = screen.getByTestId("task-card-task-1");
    expect(card).not.toHaveAttribute("data-placeholder");
    expect(card.className).not.toContain("border-dashed");
  });

  it("is the column's job to mark which card is the one in the air", () => {
    renderWithProviders(
      <TaskColumnPanel
        column="IDEA"
        tasks={[aTask({ id: "a", title: "Первая" }), aTask({ id: "b", title: "Вторая" })]}
        draggable
        draggingId="b"
      />,
      { route: "/tasks" },
    );

    expect(screen.getByTestId("task-card-b")).toHaveAttribute("data-placeholder", "true");
    expect(screen.getByTestId("task-card-a")).not.toHaveAttribute("data-placeholder");
  });
});

describe("what a card shows without being opened", () => {
  const project = { id: "project-1", clientId: "c1", name: "Летний запуск", niche: null,
    monthlyBudget: null, priority: "NEW" as const, image: null, avatarPath: null,
    position: 0, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" };
  const member = { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com",
    image: null, role: "MANAGER" as const, status: "ACTIVE" as const,
    createdAt: "2026-09-01T00:00:00.000Z" };

  it("shows a paperclip and a count when the task carries files", () => {
    renderWithProviders(
      <TaskCard task={aTask({ imageIds: ["one", "two"] })} draggable={false} />,
      { route: "/tasks" },
    );
    const badge = screen.getByTestId("task-attachments-task-1");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("2");
  });

  it("shows no paperclip when it carries none", () => {
    renderWithProviders(<TaskCard task={aTask()} draggable={false} />, { route: "/tasks" });
    expect(screen.queryByTestId("task-attachments-task-1")).not.toBeInTheDocument();
  });

  it("names the project it belongs to, with its avatar", () => {
    renderWithProviders(
      <TaskCard task={aTask()} draggable={false} project={project} />,
      { route: "/tasks" },
    );
    const footer = screen.getByTestId("task-project-task-1");
    expect(footer.textContent).toContain("Летний запуск");
    // No logo on this project, so the avatar falls back to its initial.
    expect(footer.textContent).toContain("Л");
  });

  it("shows the responsible member's avatar", () => {
    renderWithProviders(
      <TaskCard task={aTask({ assigneeId: "member-1" })} draggable={false} assignee={member} />,
      { route: "/tasks" },
    );
    const assignee = screen.getByTestId("task-assignee-task-1");
    expect(assignee).toHaveAttribute("title", "Пётр");
    expect(assignee.textContent).toContain("П");
  });

  it("uses the member's picture when they have one", () => {
    renderWithProviders(
      <TaskCard
        task={aTask({ assigneeId: "member-1" })}
        draggable={false}
        assignee={{ ...member, image: "data:image/png;base64,AAA" }}
      />,
      { route: "/tasks" },
    );
    expect(screen.getByRole("img", { name: "Пётр" })).toBeInTheDocument();
  });

  it("says so when nobody is responsible, and when there is no project", () => {
    renderWithProviders(<TaskCard task={aTask()} draggable={false} />, { route: "/tasks" });
    expect(screen.getByText("Не назначен")).toBeInTheDocument();
    expect(screen.getByText("Без проекта")).toBeInTheDocument();
  });

  it("carries the project and the assignee through from the board", async () => {
    server.use(
      mock.get("/api/tasks", () => HttpResponse.json([
        aTask({ projectId: "project-1", assigneeId: "member-1", imageIds: ["one"] }),
      ])),
      mock.get("/api/projects", () => HttpResponse.json([project])),
      mock.get("/api/members", () => HttpResponse.json([member])),
    );
    board();

    expect(await screen.findByTestId("task-project-task-1")).toHaveTextContent("Летний запуск");
    expect(await screen.findByTestId("task-assignee-task-1")).toHaveAttribute("title", "Пётр");
    expect(await screen.findByTestId("task-attachments-task-1")).toBeInTheDocument();
  });
});


describe("the card's anatomy", () => {
  it("shows the priority in the card's top corner, beside the title", () => {
    renderWithProviders(
      <TaskCard task={aTask({ priority: "URGENT" })} draggable={false} />,
      { route: "/tasks" },
    );

    const badge = screen.getByTestId("task-priority-task-1");
    const header = screen.getByTestId("task-header-task-1");
    // Beside the title rather than below it: the corner is where the eye goes
    // when scanning a column of cards.
    expect(header).toContainElement(badge);
    expect(badge).toHaveTextContent("Срочный");
  });

  it("marks the priority so it can be told apart at a glance", () => {
    renderWithProviders(
      <TaskCard task={aTask({ priority: "URGENT" })} draggable={false} />,
      { route: "/tasks" },
    );
    expect(screen.getByTestId("task-priority-task-1")).toHaveAttribute("data-priority", "URGENT");
  });

  it("keeps the title readable when it is long", () => {
    renderWithProviders(
      <TaskCard task={aTask({ title: "Очень длинное название ".repeat(10) })} draggable={false} />,
      { route: "/tasks" },
    );
    const header = screen.getByTestId("task-header-task-1");
    const title = header.querySelector("h3")!;
    // Clamped rather than allowed to push the card to any height it likes.
    expect(title.className).toMatch(/line-clamp/);
  });

  it("reserves the drag gutter whether or not the card can be dragged", () => {
    const { rerender } = renderWithProviders(
      <TaskCard task={aTask()} draggable={false} />, { route: "/tasks" },
    );
    const still = screen.getByTestId("task-card-task-1").className;

    rerender(<TaskCard task={aTask()} draggable />);

    // The same padding either way: a card that gains a handle on hover must not
    // reflow its own text as the pointer crosses it.
    expect(screen.getByTestId("task-card-task-1").className).toBe(still);
  });
});


describe("creating into a column", () => {
  it("offers an add button on every column", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    renderWithProviders(<TaskBoard onCreate={() => {}} />, { route: "/tasks" });

    await waitFor(() => expect(screen.getByTestId("task-column-IDEA")).toBeInTheDocument());
    for (const column of ["IDEA", "IN_PROGRESS", "DONE"]) {
      expect(screen.getByTestId(`task-add-${column}`)).toBeInTheDocument();
    }
  });

  // The point of a per-column button: the task lands where it was asked for,
  // not in the default column with a move to follow.
  it("names the column it was pressed on", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    renderWithProviders(<TaskBoard onCreate={onCreate} />, { route: "/tasks" });

    await waitFor(() => expect(screen.getByTestId("task-column-IN_REVIEW")).toBeInTheDocument());
    await user.click(screen.getByTestId("task-add-IN_REVIEW"));

    expect(onCreate).toHaveBeenCalledWith("IN_REVIEW");
  });

  it("offers no add button when the board is read-only", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    renderWithProviders(<TaskBoard />, { route: "/tasks" });

    await waitFor(() => expect(screen.getByTestId("task-column-IDEA")).toBeInTheDocument());
    expect(screen.queryByTestId("task-add-IDEA")).not.toBeInTheDocument();
  });

  it("does not open a card when the add button is pressed", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    renderWithProviders(<TaskBoard onCreate={() => {}} onOpen={onOpen} />, { route: "/tasks" });

    await waitFor(() => expect(screen.getByTestId("task-column-IDEA")).toBeInTheDocument());
    await user.click(screen.getByTestId("task-add-IDEA"));

    expect(onOpen).not.toHaveBeenCalled();
  });
});
