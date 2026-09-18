import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";
import type { Task } from "@/entities/task/index.js";

const members = [
  { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

let sent: Record<string, unknown> | null = null;

beforeEach(() => {
  sent = null;
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1", name: "Летний запуск" })])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/projects/:projectId/campaigns/names", () => HttpResponse.json([])),
  );
});

async function open(name: string) {
  const control = screen.queryByRole("button", { name });
  if (control) await userEvent.click(control);
}

function edit(task: Partial<Task> = {}) {
  const existing = aTask({ projectId: "project-1", ...task });
  server.use(
    mock.patch("/api/tasks/:id", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...existing, ...sent });
    }),
  );
  renderWithProviders(<TaskFormDialog task={existing} onClose={() => {}} />, { route: "/tasks" });
  return existing;
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

describe("a task's due date in the form", () => {
  it("says the task has no due date until one is chosen", async () => {
    edit();
    await open("Даты");
    expect(await screen.findByRole("button", { name: /Без срока/ })).toBeInTheDocument();
  });

  it("shows the due date a task already has", async () => {
    edit({ dueDate: "2026-09-25", dueTime: "12:00" });
    await open("Даты");
    expect(await screen.findByRole("button", { name: /25 сентября/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Время")).toHaveValue("12:00");
  });

  it("sets a due date chosen from the calendar", async () => {
    edit({ dueDate: "2026-09-01" });
    await open("Даты");
    await userEvent.click(await screen.findByRole("button", { name: /1 сентября/ }));
    const calendar = await screen.findByRole("dialog", { name: "Выбрать дату" });
    await userEvent.click(within(calendar).getByRole("button", { name: /25 сентября/ }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueDate: "2026-09-25" }));
  });

  it("sends a time of day with the day", async () => {
    edit({ dueDate: "2026-09-25" });
    await open("Даты");
    await userEvent.clear(await screen.findByLabelText("Время"));
    await userEvent.type(screen.getByLabelText("Время"), "12:00");
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueDate: "2026-09-25", dueTime: "12:00" }));
  });

  it("clears the due date", async () => {
    edit({ dueDate: "2026-09-25", dueTime: "12:00" });
    await open("Даты");
    await userEvent.click(await screen.findByRole("button", { name: "Убрать срок" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueDate: null }));
  });

  it("offers no time of day while the task has no day", async () => {
    edit();
    await open("Даты");
    await screen.findByRole("button", { name: /Без срока/ });
    expect(screen.queryByLabelText("Время")).not.toBeInTheDocument();
  });
});

describe("a task's repetition in the form", () => {
  it("does not repeat until a due date is chosen", async () => {
    edit();
    await open("Даты");
    await screen.findByRole("button", { name: /Без срока/ });
    expect(screen.queryByLabelText("Повтор")).not.toBeInTheDocument();
  });

  it("offers the intervals once the task has a due date", async () => {
    edit({ dueDate: "2026-09-25" });
    await open("Даты");
    await userEvent.click(await screen.findByLabelText("Повтор"));

    for (const label of ["Не повторяется", "Каждый день", "Каждую неделю", "Каждые 2 недели", "Каждый месяц"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("sends the chosen interval", async () => {
    edit({ dueDate: "2026-09-25" });
    await open("Даты");
    await userEvent.click(await screen.findByLabelText("Повтор"));
    await userEvent.click(await screen.findByRole("option", { name: "Каждую неделю" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ repeatEvery: "WEEKLY" }));
  });

  it("shows the interval a task already repeats on", async () => {
    edit({ dueDate: "2026-09-25", repeatEvery: "MONTHLY" });
    await open("Даты");
    expect(await screen.findByLabelText("Повтор")).toHaveTextContent("Каждый месяц");
  });
});
