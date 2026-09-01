import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
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

    // Both images are still in the document by id.
    await waitFor(() =>
      expect(editor.querySelectorAll("[data-task-image]")).toHaveLength(2));

    // Shown as references, not as pictures: the file belongs in the attachments
    // block, and the description points at it.
    expect(editor.querySelectorAll("img")).toHaveLength(0);
    expect(within(editor).getByRole("button", { name: "Вложение 1" })).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Вложение 2" })).toBeInTheDocument();

    // The bytes are fetched by the attachments block, which draws thumbnails.
    // The description fetches nothing until a preview is opened — a task with a
    // dozen attachments would otherwise pull every one of them on open.
    await waitFor(() =>
      expect([...new Set(fetchedImages)].sort()).toEqual(["image-1", "image-2"]));
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


describe("pictures in the selects", () => {
  const withPictures = () => {
    server.use(
      mock.get("/api/projects", () => HttpResponse.json([
        aProject({ id: "project-1", name: "Летний запуск", image: "data:image/png;base64,AAA" }),
      ])),
      mock.get("/api/members", () => HttpResponse.json([
        { ...members[0], id: "member-1", name: "Пётр", image: "2026-08-31T12:00:00.000Z" },
        { ...members[0], id: "member-2", name: "Анна", image: null },
      ])),
    );
  };

  it("shows each project with its logo and name", async () => {
    withPictures();
    setup();

    await userEvent.click(await screen.findByLabelText("Проект"));

    const option = await screen.findByRole("option", { name: /Летний запуск/ });
    // The logo travels inside the project, so the option can draw it directly.
    expect(within(option).getByRole("img", { name: "Летний запуск" })).toBeInTheDocument();
  });

  it("shows each member with their picture and name", async () => {
    withPictures();
    setup();

    await userEvent.click(await screen.findByLabelText("Ответственный"));

    const option = await screen.findByRole("option", { name: /Пётр/ });
    // Fetched from its own endpoint: the value on the membership is only a
    // marker that a picture exists, never an address.
    expect(within(option).getByRole("img", { name: "Пётр" }))
      .toHaveAttribute("src", "/api/members/member-1/avatar");
  });

  it("falls back to an initial for a member with no picture", async () => {
    withPictures();
    setup();

    await userEvent.click(await screen.findByLabelText("Ответственный"));

    const option = await screen.findByRole("option", { name: /Анна/ });
    expect(within(option).queryByRole("img")).not.toBeInTheDocument();
    expect(option).toHaveTextContent("А");
  });
});


describe("the dialog's shape", () => {
  it("puts project, assignee and priority on one row", async () => {
    setup();
    await screen.findByLabelText("Проект");

    const row = screen.getByTestId("task-form-selects");
    // One row, three fields: the dialog is wide enough that stacking them
    // wasted the width and pushed the description off screen.
    expect(row.className).toContain("grid-cols-[repeat(3,minmax(0,max-content))]");
    for (const label of ["Проект", "Ответственный", "Приоритет"]) {
      expect(row).toContainElement(screen.getByLabelText(label));
    }
  });

  /**
   * The dialog primitive sets an explicit `w-[min(440px,…)]`, so a `max-w-*`
   * class is inert here — a max-width cannot widen a fixed width. The override
   * has to replace the width itself, and the proof is that the base 440px is
   * gone from the merged class list rather than merely accompanied.
   */
  it("overrides the primitive's own width rather than capping it", async () => {
    setup();
    await screen.findByLabelText("Проект");

    const className = screen.getByRole("dialog").className;
    expect(className).toContain("w-[min(880px,calc(100vw-2rem))]");
    expect(className).not.toContain("440px");
  });

  it("stays inside a narrow viewport instead of forcing a horizontal scroll", async () => {
    setup();
    await screen.findByLabelText("Проект");
    // 800px is the floor asked for, but only where there is room: below that
    // the dialog tracks the viewport rather than overflowing it.
    expect(screen.getByRole("dialog").className).toContain("min-w-[min(800px,calc(100vw-2rem))]");
  });
});

describe("creating into a chosen column", () => {
  it("sends the column it was opened for", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/tasks", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({}, { status: 201 });
    }));
    renderWithProviders(
      <TaskFormDialog column="IN_REVIEW" onClose={() => {}} />, { route: "/tasks" },
    );

    await user.type(await screen.findByLabelText("Название"), "Проверить креативы");
    await user.click(screen.getByLabelText("Проект"));
    await user.click(await screen.findByRole("option", { name: /Летний запуск/ }));
    await user.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ column: "IN_REVIEW", title: "Проверить креативы" });
  });

  // Without a column the API applies its own default, and sending one the user
  // never chose would quietly override it.
  it("sends no column when it was opened from the page header", async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(mock.post("/api/tasks", async ({ request }) => {
      body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({}, { status: 201 });
    }));
    setup();

    await user.type(await screen.findByLabelText("Название"), "Без колонки");
    await user.click(screen.getByLabelText("Проект"));
    await user.click(await screen.findByRole("option", { name: /Летний запуск/ }));
    await user.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).not.toHaveProperty("column");
  });
});


describe("the dialog's controls", () => {
  it("offers a cancel button that closes without saving", async () => {
    const user = userEvent.setup();
    let posted = false;
    const onClose = vi.fn();
    server.use(mock.post("/api/tasks", () => { posted = true; return HttpResponse.json({}, { status: 201 }); }));
    renderWithProviders(<TaskFormDialog onClose={onClose} />, { route: "/tasks" });

    await user.type(await screen.findByLabelText("Название"), "Передумал");
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(onClose).toHaveBeenCalled();
    expect(posted).toBe(false);
  });

  // Inside a form, a button with no type is a submit button — cancelling would
  // save the very task the member is abandoning.
  it("does not submit the form when cancelling", async () => {
    const user = userEvent.setup();
    let posted = false;
    server.use(mock.post("/api/tasks", () => { posted = true; return HttpResponse.json({}, { status: 201 }); }));
    setup();

    const cancel = await screen.findByRole("button", { name: "Отмена" });
    expect(cancel).toHaveAttribute("type", "button");

    await user.click(cancel);
    expect(posted).toBe(false);
  });

  it("says the project is not chosen yet", async () => {
    setup();
    // Empty until chosen, which reads as a broken control rather than an
    // unanswered question.
    expect(await screen.findByLabelText("Проект")).toHaveTextContent("Не выбран");
  });

  it("shows the chosen project instead, once one is picked", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(await screen.findByLabelText("Проект"));
    await user.click(await screen.findByRole("option", { name: /Летний запуск/ }));

    expect(screen.getByLabelText("Проект")).toHaveTextContent("Летний запуск");
  });

  it("keeps the fields on the row close together", async () => {
    setup();
    await screen.findByLabelText("Проект");
    expect(screen.getByTestId("task-form-selects").className).toMatch(/\bgap-3\b/);
  });
});


describe("attachments", () => {
  const withFiles = (imageIds: string[]) => renderWithProviders(
    <TaskFormDialog
      task={{
        id: "task-1", projectId: "project-1", orgId: "org-1", title: "С файлами",
        description: null, column: "IDEA", priority: "LOW", assigneeId: null,
        createdById: null, position: 0, imageIds,
        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
      }}
      onClose={() => {}}
    />,
    { route: "/tasks" },
  );

  it("opens a preview when a thumbnail is clicked", async () => {
    const user = userEvent.setup();
    withFiles(["image-1"]);

    await user.click(await screen.findByRole("button", { name: "Вложение 1" }));

    expect(await screen.findByTestId("task-image-preview")).toBeInTheDocument();
  });

  it("offers a remove control on each attachment", async () => {
    withFiles(["image-1", "image-2"]);
    expect(await screen.findByTestId("task-attachment-remove-image-1")).toBeInTheDocument();
    expect(await screen.findByTestId("task-attachment-remove-image-2")).toBeInTheDocument();
  });

  it("deletes the attachment from the task", async () => {
    const user = userEvent.setup();
    let deleted: string | null = null;
    server.use(mock.delete("/api/task-images/:id", ({ params }) => {
      deleted = String(params.id);
      return new HttpResponse(null, { status: 204 });
    }));
    withFiles(["image-1", "image-2"]);

    await user.click(await screen.findByTestId("task-attachment-remove-image-1"));

    await waitFor(() => expect(deleted).toBe("image-1"));
    await waitFor(() =>
      expect(screen.queryByTestId("task-attachment-image-1")).not.toBeInTheDocument());
    expect(screen.getByTestId("task-attachment-image-2")).toBeInTheDocument();
  });

  // Removing is destructive and the control only appears on hover, so a stray
  // click must not silently take a file off the task.
  it("puts the attachment back when the server refuses", async () => {
    const user = userEvent.setup();
    server.use(mock.delete("/api/task-images/:id", () =>
      HttpResponse.json({ error: { message: "нельзя" } }, { status: 403 })));
    withFiles(["image-1"]);

    await user.click(await screen.findByTestId("task-attachment-remove-image-1"));

    await waitFor(() =>
      expect(screen.getByTestId("task-attachment-image-1")).toBeInTheDocument());
  });

  it("does not open the preview when the remove control is clicked", async () => {
    const user = userEvent.setup();
    server.use(mock.delete("/api/task-images/:id", () => new HttpResponse(null, { status: 204 })));
    withFiles(["image-1"]);

    await user.click(await screen.findByTestId("task-attachment-remove-image-1"));

    expect(screen.queryByTestId("task-image-preview")).not.toBeInTheDocument();
  });
});


/** jsdom builds no clipboard payloads of its own, so the event carries one. */
function pasteImage(target: Element) {
  const file = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    "shot.png", { type: "image/png" });
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { files: [file], getData: () => "", types: ["Files"] },
  });
  target.dispatchEvent(event);
}

async function editorSurface() {
  const wrapper = await screen.findByTestId("task-description-editor");
  return await waitFor(() => {
    const editable = wrapper.querySelector("[contenteditable]");
    if (!editable) throw new Error("the editor has not mounted yet");
    return editable;
  });
}

describe("a freshly pasted image", () => {
  beforeEach(() => {
    server.use(mock.post("/api/task-images", () => HttpResponse.json(
      { id: "image-9", taskId: null, contentType: "image/png", bytes: 8 }, { status: 201 },
    )));
  });

  /**
   * The block used to list the saved task's images, and an upload is not
   * attached to the task until the task is saved — so a file pasted into the
   * description only turned up after closing and reopening.
   */
  it("appears in the attachments block before the task is saved", async () => {
    renderWithProviders(
      <TaskFormDialog
        task={{
          id: "task-1", projectId: "project-1", orgId: "org-1", title: "С файлами",
          description: null, column: "IDEA", priority: "LOW", assigneeId: null,
          createdById: null, position: 0, imageIds: ["image-1"],
          createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
        }}
        onClose={() => {}}
      />,
      { route: "/tasks" },
    );

    pasteImage(await editorSurface());

    expect(await screen.findByTestId("task-attachment-image-9")).toBeInTheDocument();
    // The one already saved stays listed beside it.
    expect(screen.getByTestId("task-attachment-image-1")).toBeInTheDocument();
  });

  it("appears while creating a task that has never been saved", async () => {
    setup();

    pasteImage(await editorSurface());

    expect(await screen.findByTestId("task-attachment-image-9")).toBeInTheDocument();
  });

  it("shows the attachments block on a new task, empty until something lands", async () => {
    setup();
    const block = await screen.findByTestId("task-attachments");
    expect(block).toHaveTextContent("Файлов нет");
  });
});


describe("removing an attachment reaches the description", () => {
  beforeEach(() => {
    server.use(mock.delete("/api/task-images/:id", () => new HttpResponse(null, { status: 204 })));
  });

  const described = (imageId: string) => ({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "до " },
        { type: "taskImage", attrs: { imageId } },
        { type: "text", text: " после" },
      ],
    }],
  });

  /**
   * The editor is uncontrolled — it reads its content once, so that typing the
   * first character cannot rebuild it and steal focus. A removal therefore has
   * to be pushed into it as a command; otherwise the link stays on screen and
   * saving writes the dead reference straight back.
   */
  it("takes the link out of the editor as well", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TaskFormDialog
        task={{
          id: "task-1", projectId: "project-1", orgId: "org-1", title: "С файлом",
          description: described("image-1"), column: "IDEA", priority: "LOW",
          assigneeId: null, createdById: null, position: 0, imageIds: ["image-1"],
          createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
        }}
        onClose={() => {}}
      />,
      { route: "/tasks" },
    );

    const editor = await screen.findByTestId("task-description-editor");
    await waitFor(() =>
      expect(within(editor).getByRole("button", { name: "Вложение 1" })).toBeInTheDocument());

    await user.click(screen.getByTestId("task-attachment-remove-image-1"));

    await waitFor(() =>
      expect(within(editor).queryByRole("button", { name: "Вложение 1" })).not.toBeInTheDocument());
    // The words either side of it stay put.
    expect(editor.textContent).toContain("до");
    expect(editor.textContent).toContain("после");
  });

  it("does not save the removed reference back", async () => {
    const user = userEvent.setup();
    let saved: { description?: unknown } | null = null;
    server.use(mock.patch("/api/tasks/:id", async ({ request }) => {
      saved = await request.json() as { description?: unknown };
      return HttpResponse.json({}, { status: 200 });
    }));
    renderWithProviders(
      <TaskFormDialog
        task={{
          id: "task-1", projectId: "project-1", orgId: "org-1", title: "С файлом",
          description: described("image-1"), column: "IDEA", priority: "LOW",
          assigneeId: null, createdById: null, position: 0, imageIds: ["image-1"],
          createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
        }}
        onClose={() => {}}
      />,
      { route: "/tasks" },
    );

    await user.click(await screen.findByTestId("task-attachment-remove-image-1"));
    await waitFor(() =>
      expect(screen.queryByTestId("task-attachment-image-1")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(JSON.stringify(saved!.description)).not.toContain("image-1");
    expect(JSON.stringify(saved!.description)).toContain("после");
  });
});
