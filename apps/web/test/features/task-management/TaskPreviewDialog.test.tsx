import { http as mock, HttpResponse } from "msw";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskPreviewDialog } from "@/features/task-management/index.js";

const members = [
  { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null,
    role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

beforeEach(() => {
  server.use(
    mock.get("/api/projects", () =>
      HttpResponse.json([aProject({ id: "project-1", name: "Летний запуск" })])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/projects/project-1/campaigns/names", () => HttpResponse.json([
      { id: "camp-1", name: "Поиск / Москва", channel: "YANDEX" },
    ])),
    mock.get("/api/task-images/:id", () =>
      HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { "Content-Type": "image/png" } })),
  );
});

const open = (task = aTask()) =>
  renderWithProviders(<TaskPreviewDialog task={task} onClose={() => {}} />, { route: "/projects" });

describe("TaskPreviewDialog", () => {
  it("names the task and the stage it is at", async () => {
    open(aTask({ title: "Переписать объявления", column: "IN_REVIEW" }));

    expect(await screen.findByRole("heading", { name: "Переписать объявления" }))
      .toBeInTheDocument();
    expect(screen.getByText("На проверке")).toBeInTheDocument();
  });

  it("shows the priority, the project and the responsible member", async () => {
    open(aTask({ priority: "URGENT", projectId: "project-1", assigneeId: "member-1" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Срочный")).toBeInTheDocument();
    expect(await within(dialog).findByText("Летний запуск")).toBeInTheDocument();
    expect(await within(dialog).findByText("Пётр")).toBeInTheDocument();
  });

  it("names the campaign the work is about", async () => {
    open(aTask({ projectId: "project-1", campaignId: "camp-1" }));

    expect(await screen.findByText("Поиск / Москва")).toBeInTheDocument();
  });

  it("says Общий when the task names no campaign", async () => {
    open(aTask({ projectId: "project-1", campaignId: null }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Общий")).toBeInTheDocument();
  });

  it("shows the description as written", async () => {
    open(aTask({ description: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Заголовки под гео" }] }],
    } }));

    expect(await screen.findByText("Заголовки под гео")).toBeInTheDocument();
  });

  it("says so when the task has no description", async () => {
    open(aTask({ description: null }));

    expect(await screen.findByText("Без описания")).toBeInTheDocument();
  });

  // This is a place to read. The board is where work is managed.
  it("carries no control that changes the task", async () => {
    open(aTask({
      projectId: "project-1", assigneeId: "member-1",
      description: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Текст" }] }],
      },
    }));
    await screen.findByRole("dialog");

    for (const name of ["Сохранить", "Удалить", "Создать задачу", "Редактировать"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Описание")).toHaveAttribute("contenteditable", "false");
  });

  it("closes on request", async () => {
    const user = userEvent.setup();
    let closed = false;
    renderWithProviders(
      <TaskPreviewDialog task={aTask()} onClose={() => { closed = true; }} />,
      { route: "/projects" },
    );

    // The dialog's own X closes it too, so this names the footer's button
    // rather than whichever of the two the query happens to find first.
    const footer = (await screen.findByRole("dialog")).querySelector("[data-slot='dialog-footer']");
    await user.click(within(footer as HTMLElement).getByRole("button", { name: "Закрыть" }));

    expect(closed).toBe(true);
  });
});
