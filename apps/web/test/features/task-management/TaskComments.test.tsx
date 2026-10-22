import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TaskComments } from "@/features/task-management/ui/TaskComments.js";

const person = (id: string, userId: string, name: string, role = "MANAGER") => ({
  id, userId, name, email: `${id}@acme.com`, image: null, phone: null, telegram: null,
  role, status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z",
});

const members = [
  person("m-me", "user-1", "Я", "ADMIN"),
  person("m-anna", "u2", "Анна"),
  person("m-boris", "u3", "Борис"),
  person("m-vera", "u4", "Вера"),
];

const task = aTask({ id: "task-1", participantIds: ["m-anna", "m-boris"], createdById: "m-anna" });

const written = (overrides: Record<string, unknown> = {}) => ({
  id: "c1", taskId: "task-1", authorId: "m-anna", body: "Готово", mentionIds: [],
  createdAt: "2026-10-20T10:30:00.000Z", ...overrides,
});

function serve(comments: unknown[] = []) {
  const posted: unknown[] = [];
  server.use(
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/tasks/task-1/comments", () => HttpResponse.json(comments)),
    mock.post("/api/tasks/task-1/comments", async ({ request }) => {
      const body = await request.json();
      posted.push(body);
      return HttpResponse.json(written({ id: "new", ...(body as object) }), { status: 201 });
    }),
  );
  return posted;
}

const field = () => screen.getByRole("textbox", { name: "Текст комментария" });

describe("the comments of a task", () => {
  it("say so when there are none", async () => {
    serve();
    renderWithProviders(<TaskComments task={task} />);

    expect(await screen.findByText("Комментариев пока нет")).toBeInTheDocument();
  });

  it("show each comment with its author and text", async () => {
    serve([written({ body: "Макет готов" })]);
    renderWithProviders(<TaskComments task={task} />);

    expect(await screen.findByText("Макет готов")).toBeInTheDocument();
    expect(screen.getByText("Анна")).toBeInTheDocument();
  });

  it("mark a tagged name in a comment", async () => {
    serve([written({ body: "@Борис глянь", mentionIds: ["m-boris"] })]);
    renderWithProviders(<TaskComments task={task} />);

    const tag = await screen.findByText("@Борис");
    expect(tag).toHaveAttribute("data-tag");
  });

  it("send what is typed and clear the field", async () => {
    const posted = serve();
    const user = userEvent.setup();
    renderWithProviders(<TaskComments task={task} />);
    await screen.findByText("Комментариев пока нет");

    await user.type(field(), "Привет");
    await user.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => expect(posted).toEqual([{ body: "Привет", mentionIds: [] }]));
    await waitFor(() => expect(field()).toHaveValue(""));
  });

  it("cannot send an empty comment", async () => {
    serve();
    renderWithProviders(<TaskComments task={task} />);
    await screen.findByText("Комментариев пока нет");

    expect(screen.getByRole("button", { name: "Отправить" })).toBeDisabled();
  });

  it("offer the people on the task when @ is typed", async () => {
    serve();
    const user = userEvent.setup();
    renderWithProviders(<TaskComments task={task} />);
    await screen.findByText("Комментариев пока нет");

    await user.type(field(), "@");

    const options = within(await screen.findByRole("listbox", { name: "Упомянуть участника" })).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Анна");
    expect(options[1]).toHaveTextContent("Борис");
  });

  it("narrow the offer as letters are typed", async () => {
    serve();
    const user = userEvent.setup();
    renderWithProviders(<TaskComments task={task} />);
    await screen.findByText("Комментариев пока нет");

    await user.type(field(), "@бор");

    const options = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Борис");
  });

  it("tag the person chosen from the offer", async () => {
    const posted = serve();
    const user = userEvent.setup();
    renderWithProviders(<TaskComments task={task} />);
    await screen.findByText("Комментариев пока нет");

    await user.type(field(), "глянь @бо");
    await user.click(await screen.findByRole("option", { name: /Борис/ }));
    expect(field()).toHaveValue("глянь @Борис ");
    await user.type(field(), "спасибо");
    await user.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => expect(posted).toEqual([{ body: "глянь @Борис спасибо", mentionIds: ["m-boris"] }]));
  });

  it("choose with the keyboard", async () => {
    const posted = serve();
    const user = userEvent.setup();
    renderWithProviders(<TaskComments task={task} />);
    await screen.findByText("Комментариев пока нет");

    await user.type(field(), "@{ArrowDown}{Enter}");
    await user.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => expect(posted).toEqual([{ body: "@Борис", mentionIds: ["m-boris"] }]));
  });

  it("do not tag a person whose name was erased afterwards", async () => {
    const posted = serve();
    const user = userEvent.setup();
    renderWithProviders(<TaskComments task={task} />);
    await screen.findByText("Комментариев пока нет");

    await user.type(field(), "@бо");
    await user.click(await screen.findByRole("option", { name: /Борис/ }));
    await user.clear(field());
    await user.type(field(), "просто так");
    await user.click(screen.getByRole("button", { name: "Отправить" }));

    await waitFor(() => expect(posted).toEqual([{ body: "просто так", mentionIds: [] }]));
  });

  it("can be deleted by an admin", async () => {
    let deleted = false;
    serve([written()]);
    server.use(mock.delete("/api/tasks/task-1/comments/c1", () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }));
    const user = userEvent.setup();
    renderWithProviders(<TaskComments task={task} />);

    await user.click(await screen.findByRole("button", { name: "Удалить комментарий" }));

    await waitFor(() => expect(deleted).toBe(true));
  });
});
