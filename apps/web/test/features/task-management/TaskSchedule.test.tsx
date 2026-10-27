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
    expect(screen.getByLabelText("Начало")).toHaveValue("12:00");
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
    await userEvent.clear(await screen.findByLabelText("Начало"));
    await userEvent.type(screen.getByLabelText("Начало"), "12:00");
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueDate: "2026-09-25", dueTime: "12:00" }));
  });

  it("clears the due date", async () => {
    edit({ dueDate: "2026-09-25", dueTime: "12:00" });
    await open("Даты");
    const block = screen.getByTestId("task-block-dates");
    await userEvent.click(within(block).getByRole("button", { name: "Убрать даты" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueDate: null }));
  });

  it("offers no time of day while the task has no day", async () => {
    edit();
    await open("Даты");
    await screen.findByRole("button", { name: /Без срока/ });
    expect(screen.queryByLabelText("Начало")).not.toBeInTheDocument();
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

describe("marking a task as a call in the form", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is offered while a task is created, and sent with it", async () => {
    let created: Record<string, unknown> | null = null;
    server.use(mock.post("/api/tasks", async ({ request }) => {
      created = await request.json() as Record<string, unknown>;
      return HttpResponse.json(aTask(created as Partial<Task>), { status: 201 });
    }));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0));
    renderWithProviders(<TaskFormDialog onClose={() => {}} />, { route: "/tasks" });
    await userEvent.type(await screen.findByLabelText("Название"), "Планёрка");
    await open("Даты");
    await userEvent.click(await screen.findByRole("button", { name: /Без срока/ }));
    const calendar = await screen.findByRole("dialog", { name: "Выбрать дату" });
    await userEvent.click(within(calendar).getByRole("button", { name: /22 октября/ }));
    await userEvent.type(await screen.findByLabelText("Начало"), "10:00");
    await repeat("Каждый день");

    await userEvent.click(await screen.findByRole("switch", { name: "Созвон" }));
    await userEvent.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(created).toMatchObject({
      dueDate: "2026-10-22", dueTime: "10:00", repeatEvery: "DAILY", isCall: true,
    }));
  });

  const callBox = () => screen.queryByRole("switch", { name: "Созвон" });

  async function repeat(label: string) {
    await userEvent.click(await screen.findByLabelText("Повтор"));
    await userEvent.click(await screen.findByRole("option", { name: label }));
  }

  it("is offered for a timed task that does not repeat, and sent when ticked", async () => {
    edit({ dueDate: "2026-10-19", dueTime: "10:00" });
    await open("Даты");

    await userEvent.click(await screen.findByRole("switch", { name: "Созвон" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ repeatEvery: "NONE", isCall: true }));
  });

  it("is not offered for a repeating task with no time", async () => {
    edit({ dueDate: "2026-10-19", repeatEvery: "WEEKLY" });
    await open("Даты");
    await screen.findByLabelText("Повтор");

    expect(callBox()).not.toBeInTheDocument();
  });

  it("is offered once the timed task repeats, and sent when ticked", async () => {
    edit({ dueDate: "2026-10-19", dueTime: "10:00" });
    await open("Даты");
    await repeat("Каждую неделю");

    await userEvent.click(await screen.findByRole("switch", { name: "Созвон" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ repeatEvery: "WEEKLY", isCall: true }));
  });

  it("shows a call ticked", async () => {
    edit({ dueDate: "2026-10-19", dueTime: "10:00", repeatEvery: "WEEKLY", isCall: true });
    await open("Даты");

    expect(await screen.findByRole("switch", { name: "Созвон" })).toBeChecked();
  });

  it("stays when the repetition goes", async () => {
    edit({ dueDate: "2026-10-19", dueTime: "10:00", repeatEvery: "WEEKLY", isCall: true });
    await open("Даты");
    await screen.findByRole("switch", { name: "Созвон" });

    await repeat("Не повторяется");
    expect(callBox()).toBeChecked();
    await save();

    await waitFor(() => expect(sent).toMatchObject({ repeatEvery: "NONE", isCall: true }));
  });

  it("goes away with the time, and the task is no longer sent as a call", async () => {
    edit({ dueDate: "2026-10-19", dueTime: "10:00", isCall: true });
    await open("Даты");
    await screen.findByRole("switch", { name: "Созвон" });

    await userEvent.clear(screen.getByLabelText("Начало"));
    expect(callBox()).not.toBeInTheDocument();
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueTime: null, isCall: false }));
  });
});

describe("skipping weekends in the form", () => {
  const weekendsBox = () => screen.queryByRole("checkbox", { name: "Пропускать выходные" });

  async function repeat(label: string) {
    await userEvent.click(await screen.findByLabelText("Повтор"));
    await userEvent.click(await screen.findByRole("option", { name: label }));
  }

  it("is offered once the task repeats, and sent when ticked", async () => {
    edit({ dueDate: "2026-10-19" });
    await open("Даты");
    await screen.findByLabelText("Повтор");
    expect(weekendsBox()).not.toBeInTheDocument();

    await repeat("Каждый день");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Пропускать выходные" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ repeatEvery: "DAILY", skipWeekends: true }));
  });

  it("shows a task that skips weekends ticked", async () => {
    edit({ dueDate: "2026-10-19", repeatEvery: "DAILY", skipWeekends: true });
    await open("Даты");

    expect(await screen.findByRole("checkbox", { name: "Пропускать выходные" })).toBeChecked();
  });

  it("goes away with the repetition, and the task no longer skips weekends", async () => {
    edit({ dueDate: "2026-10-19", repeatEvery: "DAILY", skipWeekends: true });
    await open("Даты");
    await screen.findByRole("checkbox", { name: "Пропускать выходные" });

    await repeat("Не повторяется");
    expect(weekendsBox()).not.toBeInTheDocument();
    await save();

    await waitFor(() => expect(sent).toMatchObject({ repeatEvery: "NONE", skipWeekends: false }));
  });
});

describe("the time zone of a task's schedule in the form", () => {
  it("is left alone when the day and times are", async () => {
    edit({ title: "Планёрка", dueDate: "2026-10-19", dueTime: "10:00", endTime: "11:00", timeZone: "Europe/Minsk" });
    await userEvent.type(await screen.findByLabelText("Название"), "!");
    await save();

    await waitFor(() => expect(sent).toMatchObject({ title: "Планёрка!" }));
    expect(sent).not.toHaveProperty("dueDate");
    expect(sent).not.toHaveProperty("dueTime");
    expect(sent).not.toHaveProperty("timeZone");
  });

  it("is the member's own once they change the time", async () => {
    edit({ dueDate: "2026-10-19", dueTime: "10:00", timeZone: "Europe/Minsk" });
    await open("Даты");
    await userEvent.clear(await screen.findByLabelText("Начало"));
    await userEvent.type(screen.getByLabelText("Начало"), "12:00");
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueDate: "2026-10-19", dueTime: "12:00", timeZone: "Asia/Tokyo" }));
  });
});
