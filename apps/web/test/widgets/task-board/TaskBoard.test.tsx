import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { Routes, Route } from "react-router-dom";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskBoard } from "@/widgets/task-board/index.js";

function setup() {
  return renderWithProviders(
    <Routes><Route path="*" element={<TaskBoard />} /></Routes>,
    { route: "/tasks" },
  );
}

const COLUMNS = ["Идея", "В работе", "На исправление", "На проверке", "Готово", "Архив"];

describe("TaskBoard", () => {
  it("draws the six columns in the order the product asked for", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([])));
    setup();

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(COLUMNS);
  });

  it("draws a column that holds nothing, in its place", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([aTask({ column: "DONE" })])));
    setup();

    // "На исправление" holds no cards and is still there, with a count of zero.
    const column = await screen.findByLabelText("На исправление");
    expect(column).toBeInTheDocument();
    expect(column.textContent).toContain("0");
  });

  it("orders the cards within a column by position", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      aTask({ id: "b", title: "Второй", position: 1 }),
      aTask({ id: "a", title: "Первый", position: 0 }),
    ])));
    setup();

    await screen.findByText("Первый");
    const column = screen.getByLabelText("Идея");
    const titles = [...column.querySelectorAll("article h3")].map((node) => node.textContent);
    expect(titles).toEqual(["Первый", "Второй"]);
  });

  it("puts each card in the column it belongs to", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([
      aTask({ id: "a", title: "Идейная", column: "IDEA" }),
      aTask({ id: "b", title: "Готовая", column: "DONE" }),
    ])));
    setup();

    await screen.findByText("Идейная");
    expect(screen.getByLabelText("Идея").textContent).toContain("Идейная");
    expect(screen.getByLabelText("Готово").textContent).toContain("Готовая");
  });

  it("shows each card's priority", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([aTask({ priority: "URGENT" })])));
    setup();
    expect(await screen.findByText("Срочный")).toBeInTheDocument();
  });

  it("reports a board it could not load", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json({ error: { message: "no" } }, { status: 500 })));
    setup();
    expect(await screen.findByText("Не удалось загрузить задачи")).toBeInTheDocument();
  });

  it("lets a member who may write drag a card, by its body or its handle", async () => {
    server.use(mock.get("/api/tasks", () => HttpResponse.json([aTask({ title: "Перетащи" })])));
    setup();

    const card = await screen.findByTestId("task-card-task-1");
    expect(card).toHaveAttribute("data-draggable", "true");
    // The handle exists for keyboard dragging: Enter and Space on the card
    // itself belong to opening it.
    expect(screen.getByTestId("task-drag-task-1")).toBeInTheDocument();
  });

  it("does not let a guest drag a card, but still lets them open it", async () => {
    server.use(
      mock.get("/api/auth/me", () => HttpResponse.json({
        user: { id: "user-1", name: "Guest", email: "g@acme.com", image: null },
        organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
        role: "GUEST",
        clientIds: [],
      })),
      mock.get("/api/tasks", () => HttpResponse.json([aTask({ title: "Только чтение" })])),
    );
    setup();

    const card = await screen.findByTestId("task-card-task-1");
    await waitFor(() => expect(card).not.toHaveAttribute("data-draggable"));
    expect(screen.queryByTestId("task-drag-task-1")).not.toBeInTheDocument();
    // Reading a task is not writing to it: the card still opens.
    expect(card).toHaveAttribute("role", "button");
  });
});
