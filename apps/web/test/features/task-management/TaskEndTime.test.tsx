import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskCardView, TaskFormDialog } from "@/features/task-management/index.js";
import {
  endEnteredAs,
  endKeepingLength,
  endShownAs,
  endsAfterStart,
  timeRange,
  type Task,
} from "@/entities/task/index.js";

let sent: Record<string, unknown> | null = null;

beforeEach(() => {
  sent = null;
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1", name: "Летний запуск" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
  );
});

function edit(task: Partial<Task> = {}) {
  const existing = aTask({ projectId: "project-1", dueDate: "2026-09-25", ...task });
  server.use(
    mock.patch("/api/tasks/:id", async ({ request }) => {
      sent = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...existing, ...sent });
    }),
  );
  renderWithProviders(<TaskFormDialog task={existing} onClose={() => {}} />, { route: "/tasks" });
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
const end = () => screen.queryByLabelText("Окончание");
const enterEnd = (value: string) => fireEvent.change(screen.getByLabelText("Окончание"), { target: { value } });

describe("the end of a task in the form", () => {
  it("is not offered until the task has a start", async () => {
    edit();
    await screen.findByLabelText("Начало");
    expect(end()).not.toBeInTheDocument();
  });

  it("is a time field like the start, showing the end a task already has", async () => {
    edit({ dueTime: "12:00", endTime: "13:30" });
    await screen.findByLabelText("Начало");
    expect(end()).toHaveAttribute("type", "time");
    expect(end()).toHaveValue("13:30");
  });

  it("sends the end entered", async () => {
    edit({ dueTime: "12:00" });
    await screen.findByLabelText("Окончание");

    enterEnd("13:30");
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueTime: "12:00", endTime: "13:30" }));
  });

  it("takes 00:00 as midnight, the end of the day", async () => {
    edit({ dueTime: "22:00" });
    await screen.findByLabelText("Окончание");

    enterEnd("00:00");
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueTime: "22:00", endTime: "24:00" }));
  });

  it("shows an end at midnight as 00:00", async () => {
    edit({ dueTime: "22:00", endTime: "24:00" });
    expect(await screen.findByLabelText("Окончание")).toHaveValue("00:00");
  });

  it("refuses an end before the start, saying so and sending nothing", async () => {
    edit({ dueTime: "12:00" });
    await screen.findByLabelText("Окончание");

    enterEnd("11:00");
    await save();

    expect(await screen.findByText("Окончание должно быть позже начала")).toBeInTheDocument();
    expect(end()).toHaveAttribute("aria-invalid", "true");
    expect(sent).toBeNull();
  });

  it("forgets the complaint once the end is changed", async () => {
    edit({ dueTime: "12:00" });
    await screen.findByLabelText("Окончание");
    enterEnd("11:00");
    await save();
    await screen.findByText("Окончание должно быть позже начала");

    enterEnd("12:30");

    expect(screen.queryByText("Окончание должно быть позже начала")).not.toBeInTheDocument();
    await save();
    await waitFor(() => expect(sent).toMatchObject({ endTime: "12:30" }));
  });

  it("moves with the start, keeping the length", async () => {
    edit({ dueTime: "12:00", endTime: "13:30" });

    fireEvent.change(await screen.findByLabelText("Начало"), { target: { value: "15:00" } });

    expect(end()).toHaveValue("16:30");
    await save();
    await waitFor(() => expect(sent).toMatchObject({ dueTime: "15:00", endTime: "16:30" }));
  });

  it("is cleared with the start", async () => {
    edit({ dueTime: "12:00", endTime: "13:30" });

    fireEvent.change(await screen.findByLabelText("Начало"), { target: { value: "" } });

    expect(end()).not.toBeInTheDocument();
    await save();
    await waitFor(() => expect(sent).toMatchObject({ dueTime: null, endTime: null }));
  });

  it("is cleared with the dates block", async () => {
    edit({ dueTime: "12:00", endTime: "13:30" });
    const block = await screen.findByTestId("task-block-dates");

    await userEvent.click(within(block).getByRole("button", { name: "Убрать даты" }));
    await save();

    await waitFor(() => expect(sent).toMatchObject({ dueDate: null, dueTime: null, endTime: null }));
  });
});

describe("the end of a task on its card", () => {
  it("shows the start and the end together", () => {
    renderWithProviders(
      <TaskCardView task={aTask({ dueDate: "2026-09-25", dueTime: "12:00", endTime: "13:30" })} />,
      { route: "/tasks" },
    );
    expect(screen.getByTestId("task-due-task-1")).toHaveTextContent("25.09 12:00–13:30");
  });

  it("shows the start alone when there is no end", () => {
    renderWithProviders(
      <TaskCardView task={aTask({ dueDate: "2026-09-25", dueTime: "12:00" })} />,
      { route: "/tasks" },
    );
    expect(screen.getByTestId("task-due-task-1")).toHaveTextContent(/^25\.09 12:00$/);
  });
});

describe("the time helpers", () => {
  it("names a range, a start alone, or nothing", () => {
    expect(timeRange({ dueTime: "12:00", endTime: "13:30" })).toBe("12:00–13:30");
    expect(timeRange({ dueTime: "12:00", endTime: null })).toBe("12:00");
    expect(timeRange({ dueTime: null, endTime: null })).toBeNull();
  });

  it("keeps the length when the start moves, stopping at the end of the day", () => {
    expect(endKeepingLength("12:00", "13:30", "15:00")).toBe("16:30");
    expect(endKeepingLength("12:00", "14:00", "23:00")).toBe("24:00");
    expect(endKeepingLength("12:00", null, "15:00")).toBeNull();
    expect(endKeepingLength(null, null, "15:00")).toBeNull();
  });

  it("shows and takes midnight as 00:00 in the end field", () => {
    expect(endShownAs("24:00")).toBe("00:00");
    expect(endShownAs("13:30")).toBe("13:30");
    expect(endEnteredAs("00:00")).toBe("24:00");
    expect(endEnteredAs("13:30")).toBe("13:30");
    expect(endEnteredAs(null)).toBeNull();
  });

  it("tells an end after the start from one that is not", () => {
    expect(endsAfterStart("12:00", "12:15")).toBe(true);
    expect(endsAfterStart("12:00", "12:00")).toBe(false);
    expect(endsAfterStart("12:00", "11:00")).toBe(false);
    expect(endsAfterStart("22:00", "24:00")).toBe(true);
  });
});
