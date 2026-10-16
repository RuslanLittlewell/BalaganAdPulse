import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import type { Task, TaskColumn } from "@/entities/task/index.js";

const asRole = (role: string) => server.use(mock.get("/api/auth/me", () => HttpResponse.json({
  user: { id: "u1", name: "Кто-то", email: "s@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role,
  clientIds: [],
})));

function form(props: { task?: Task; column?: TaskColumn; onClose?: () => void }) {
  return renderWithProviders(
    <TaskFormDialog onClose={props.onClose ?? (() => {})} task={props.task} column={props.column} />,
    { route: "/tasks" },
  );
}

const stage = () => screen.findByRole("combobox", { name: "Этап" });

async function chooseStage(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await stage());
  await user.click(await screen.findByRole("option", { name }));
}

describe("the stage in the task form", () => {
  it("shows the task's current stage next to the priority", async () => {
    form({ task: aTask({ column: "IN_PROGRESS" }) });

    expect(await stage()).toHaveTextContent("В работе");
    expect(screen.getByRole("combobox", { name: "Приоритет" })).toBeInTheDocument();
  });

  it("lists every stage in the board's order", async () => {
    const user = userEvent.setup();
    form({ task: aTask() });

    await user.click(await stage());

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent))
      .toEqual(["Идея", "В работе", "На исправление", "На проверке", "Готово", "Архив"]);
  });

  it("moves the task to the top of the chosen stage before saving the rest", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    let moved: unknown = null;
    let closed = false;
    server.use(
      mock.post("/api/tasks/task-1/move", async ({ request }) => {
        calls.push("move");
        moved = await request.json();
        return HttpResponse.json(aTask({ column: "IN_REVIEW", position: 0 }));
      }),
      mock.patch("/api/tasks/task-1", () => {
        calls.push("update");
        return HttpResponse.json(aTask({ column: "IN_REVIEW", position: 0 }));
      }),
    );
    form({ task: aTask({ column: "IN_PROGRESS", position: 2 }), onClose: () => { closed = true; } });

    await chooseStage(user, "На проверке");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(calls).toEqual(["move", "update"]));
    expect(moved).toEqual({ column: "IN_REVIEW", position: 0 });
    await waitFor(() => expect(closed).toBe(true));
  });

  it("sends no move when the stage is unchanged", async () => {
    const user = userEvent.setup();
    let movedCount = 0;
    let updated = false;
    server.use(
      mock.post("/api/tasks/task-1/move", () => {
        movedCount += 1;
        return HttpResponse.json(aTask());
      }),
      mock.patch("/api/tasks/task-1", () => {
        updated = true;
        return HttpResponse.json(aTask({ title: "Новое название" }));
      }),
    );
    form({ task: aTask({ column: "IN_PROGRESS", position: 2 }) });

    const title = await screen.findByLabelText("Название");
    await user.clear(title);
    await user.type(title, "Новое название");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(updated).toBe(true));
    expect(movedCount).toBe(0);
  });

  it("keeps the form open and says so when the move is refused", async () => {
    const user = userEvent.setup();
    let updated = false;
    let closed = false;
    server.use(
      mock.post("/api/tasks/task-1/move", () =>
        HttpResponse.json({ error: { message: "нельзя" } }, { status: 403 })),
      mock.patch("/api/tasks/task-1", () => {
        updated = true;
        return HttpResponse.json(aTask());
      }),
    );
    form({ task: aTask({ column: "IN_PROGRESS" }), onClose: () => { closed = true; } });

    await chooseStage(user, "Готово");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByText("Не удалось переместить задачу")).toBeInTheDocument();
    expect(updated).toBe(false);
    expect(closed).toBe(false);
    expect(screen.getByLabelText("Название")).toBeInTheDocument();
  });

  it("shows the column a new task was opened from", async () => {
    form({ column: "NEEDS_FIX" });
    expect(await stage()).toHaveTextContent("На исправление");
  });

  it("starts a new task in Идея", async () => {
    form({});
    expect(await stage()).toHaveTextContent("Идея");
  });

  it("creates a new task in the stage chosen", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/tasks", async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(aTask({ column: "IN_PROGRESS" }), { status: 201 });
    }));
    form({ column: "NEEDS_FIX" });

    await user.type(await screen.findByLabelText("Название"), "Свежая");
    await chooseStage(user, "В работе");
    await user.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.column).toBe("IN_PROGRESS");
  });

  it("is not offered to a client, whose task starts in Идея", async () => {
    const user = userEvent.setup();
    asRole("CLIENT");
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/tasks", async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(aTask(), { status: 201 });
    }));
    form({});

    await user.type(await screen.findByLabelText("Название"), "От клиента");
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Этап" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body!.column).toBeUndefined();
  });
});
