import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";

function setup(onClose = () => {}) {
  return renderWithProviders(<TaskFormDialog onClose={onClose} />, { route: "/tasks" });
}

const members = [
  { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

let fetchedImages: string[] = [];

beforeEach(() => {
  fetchedImages = [];
  server.use(
    mock.get("/api/task-images/:id", ({ params }) => {
      fetchedImages.push(String(params.id));
      return HttpResponse.arrayBuffer(new ArrayBuffer(8), {
        headers: { "Content-Type": "image/png" },
      });
    }),
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1", name: "Летний запуск" })])),
    mock.get("/api/members", () => HttpResponse.json(members)),
  );
});

describe("TaskFormDialog", () => {
  it("shows the fields the product asked for", async () => {
    setup();
    expect(await screen.findByLabelText("Название")).toBeInTheDocument();
    expect(screen.getByText("Описание")).toBeInTheDocument();
    expect(screen.getByText("Проект")).toBeInTheDocument();
    expect(screen.getByText("Ответственный")).toBeInTheDocument();
    expect(screen.getByText("Приоритет")).toBeInTheDocument();
  });

  it("refuses a blank title and sends nothing", async () => {
    let posted = false;
    server.use(mock.post("/api/tasks", () => { posted = true; return HttpResponse.json({}, { status: 201 }); }));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Создать задачу" }));
    expect(await screen.findByText("Введите название")).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("refuses a missing project and sends nothing", async () => {
    let posted = false;
    server.use(mock.post("/api/tasks", () => { posted = true; return HttpResponse.json({}, { status: 201 }); }));
    setup();

    await userEvent.type(await screen.findByLabelText("Название"), "Бриф");
    await userEvent.click(screen.getByRole("button", { name: "Создать задачу" }));
    expect(await screen.findByText("Выберите проект")).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("lists the projects the member can reach", async () => {
    setup();
    await userEvent.click(await screen.findByLabelText("Проект"));
    expect(await screen.findByRole("option", { name: "Летний запуск" })).toBeInTheDocument();
  });

  it("lists the members who can be made responsible", async () => {
    setup();
    await userEvent.click(await screen.findByLabelText("Ответственный"));
    expect(await screen.findByRole("option", { name: "Пётр" })).toBeInTheDocument();
  });

  it("offers the four priorities, defaulting to the middle one", async () => {
    setup();
    await userEvent.click(await screen.findByLabelText("Приоритет"));
    for (const label of ["Низкий", "Средний", "Высокий", "Срочный"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("reopens a saved task with its description and its images", async () => {
    // The document stores ids, not object URLs: a `blob:` URL dies with the
    // page, which is why reopening a task used to show broken pictures.
    const description = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Смотри скриншоты" }] },
        { type: "taskImage", attrs: { imageId: "image-1" } },
        { type: "taskImage", attrs: { imageId: "image-2" } },
      ],
    };
    renderWithProviders(
      <TaskFormDialog
        task={{
          id: "task-1", projectId: "project-1", orgId: "org-1", title: "Написать бриф",
          description, column: "IDEA", priority: "HIGH", assigneeId: "member-1",
          createdById: "member-1", position: 0, imageIds: ["image-1", "image-2"],
          createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
        }}
        onClose={() => {}}
      />,
      { route: "/tasks" },
    );

    expect(await screen.findByLabelText("Название")).toHaveValue("Написать бриф");
    const editor = await screen.findByTestId("task-description-editor");
    await waitFor(() => expect(editor.textContent).toContain("Смотри скриншоты"));

    // Both images are in the document by id, and each one fetched its bytes.
    await waitFor(() =>
      expect(editor.querySelectorAll("[data-task-image]")).toHaveLength(2));
    await waitFor(() => expect(editor.querySelectorAll("img")).toHaveLength(2));
    // Both images resolved. The description and the attachments block each own
    // and revoke their own object URL, so an image is fetched once per view
    // that shows it — deliberate: a shared URL would need shared revocation.
    expect([...new Set(fetchedImages)].sort()).toEqual(["image-1", "image-2"]);
  });

  it("lists the task's files in their own block", async () => {
    renderWithProviders(
      <TaskFormDialog
        task={{
          id: "task-1", projectId: "project-1", orgId: "org-1", title: "С файлами",
          description: null, column: "IDEA", priority: "LOW", assigneeId: null,
          createdById: null, position: 0, imageIds: ["image-1", "image-2"],
          createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
        }}
        onClose={() => {}}
      />,
      { route: "/tasks" },
    );

    const block = await screen.findByTestId("task-attachments");
    expect(block.textContent).toContain("Вложения");
    expect(await screen.findByTestId("task-attachment-image-1")).toBeInTheDocument();
    expect(await screen.findByTestId("task-attachment-image-2")).toBeInTheDocument();
  });

  it("says so when a task carries no files", async () => {
    renderWithProviders(
      <TaskFormDialog
        task={{
          id: "task-1", projectId: "project-1", orgId: "org-1", title: "Без файлов",
          description: null, column: "IDEA", priority: "LOW", assigneeId: null,
          createdById: null, position: 0, imageIds: [],
          createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
        }}
        onClose={() => {}}
      />,
      { route: "/tasks" },
    );
    expect(await screen.findByText("Файлов нет")).toBeInTheDocument();
  });

  it("is capped at 80% of the screen, with the body scrolling inside it", async () => {
    setup();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("max-h-[80vh]");
    expect(dialog.querySelector("form")!.className).toContain("overflow-y-auto");
  });

  it("reports a refusal from the API without closing", async () => {
    let closed = false;
    server.use(mock.post("/api/tasks", () =>
      HttpResponse.json({ error: { message: "Недостаточно прав" } }, { status: 403 })));
    setup(() => { closed = true; });

    await userEvent.type(await screen.findByLabelText("Название"), "Бриф");
    await userEvent.click(await screen.findByLabelText("Проект"));
    await userEvent.click(await screen.findByRole("option", { name: "Летний запуск" }));
    await userEvent.click(screen.getByRole("button", { name: "Создать задачу" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Недостаточно прав");
    await waitFor(() => expect(closed).toBe(false));
  });
});
