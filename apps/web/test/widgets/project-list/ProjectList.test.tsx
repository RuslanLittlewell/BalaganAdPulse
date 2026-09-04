import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Routes, Route } from "react-router-dom";
import { server } from "@test/shared/index.js";
import { renderWithProviders } from "@test/shared/index.js";
import { aClient, aProject } from "@test/shared/index.js";
import { ProjectList } from "@/widgets/project-list/ProjectList.js";

function setup(route = "/") {
  return renderWithProviders(
    <Routes>
      <Route path="*" element={<ProjectList />} />
    </Routes>,
    { route },
  );
}

describe("ProjectList", () => {
  it("renders projects from the API", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();
    expect(await screen.findByText("Летний запуск")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("shows an empty state when there are no projects", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([])));
    setup();
    expect(await screen.findByRole("button", { name: /Новый проект/ })).toBeInTheDocument();
  });

  it("shows an error state with a retry button on failure", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json({ error: { message: "boom" } }, { status: 500 })));
    setup();
    expect(await screen.findByRole("button", { name: "Повторить" })).toBeInTheDocument();
  });

  it("opens the new-project dialog", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([])));
    setup();
    await userEvent.click(await screen.findByRole("button", { name: /Новый проект/ }));
    await waitFor(() => expect(screen.getByLabelText("Название проекта")).toBeInTheDocument());
  });

  it("sorts projects by priority from critical to new", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "new", name: "Новый", priority: "NEW" }),
      aProject({ id: "waiting", name: "Ожидает", priority: "WAITING" }),
      aProject({ id: "critical", name: "Критичный", priority: "CRITICAL" }),
      aProject({ id: "urgent", name: "Срочный", priority: "URGENT" }),
      aProject({ id: "idle", name: "Без задач", priority: "IDLE" }),
    ])));
    setup();

    await screen.findByText("Критичный");
    const names = ["Критичный", "Срочный", "Ожидает", "Без задач", "Новый"]
      .map((name) => screen.getAllByText(name).at(-1)!);
    for (let index = 0; index < names.length - 1; index += 1) {
      expect(names[index].compareDocumentPosition(names[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING)
        .toBeTruthy();
    }
  });

  it("filters projects with the priority select", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([
      aProject({ id: "critical", name: "Критичный проект", priority: "CRITICAL" }),
      aProject({ id: "idle", name: "Проект без задач", priority: "IDLE" }),
    ])));
    setup();

    const filter = await screen.findByRole("combobox", { name: "Фильтр по приоритету" });
    await userEvent.click(filter);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Все приоритеты", "Очень важно", "Есть срочные задачи",
      "В работе, ждём результата", "Нет задач", "Новый",
    ]);
    await userEvent.click(screen.getByRole("option", { name: "Нет задач" }));
    expect(screen.queryByText("Критичный проект")).not.toBeInTheDocument();
    expect(screen.getByText("Проект без задач")).toBeInTheDocument();
  });

  it("uses an icon-only new-project button at the bottom right", async () => {
    server.use(mock.get("/api/projects", () => HttpResponse.json([])));
    setup();

    const button = await screen.findByRole("button", { name: "Новый проект" });
    expect(button).toHaveClass("absolute", "right-2", "bottom-2", "rounded-full");
    expect(button).toHaveTextContent("");
  });

  it("uses the shared loader while the projects load", () => {
    setup();
    expect(screen.getByRole("status")).toHaveTextContent("Загрузка…");
  });

  it("puts an edit control on every row", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    expect(await screen.findByRole("button", { name: "Редактировать: Летний запуск" }))
      .toBeInTheDocument();
  });

  it("opens the project for editing from that control, prefilled", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ id: "1", name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ clientId: "1", name: "Летний запуск", niche: "fitness" })])),
    );
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Редактировать: Летний запуск" }));

    expect(await screen.findByRole("dialog", { name: "Редактирование проекта" })).toBeInTheDocument();
    expect(screen.getByLabelText("Название проекта")).toHaveValue("Летний запуск");
    expect(screen.getByLabelText("Ниша")).toHaveValue("fitness");
  });

  it("keeps the row itself navigating, not editing", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    await userEvent.click(await screen.findByText("Летний запуск"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("places that control after the label, at the trailing end of the row", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    const edit = await screen.findByRole("button", { name: "Редактировать: Летний запуск" });
    const label = screen.getByText("Летний запуск");
    expect(label.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks the open project, though it is rendered beside that route and not inside it", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ id: "p1", name: "Летний запуск" })])),
    );
    setup("/projects/p1/campaigns/c1");

    await screen.findByText("Летний запуск");
    expect(screen.getByText("Летний запуск").closest("[data-selected]"))
      .toHaveAttribute("data-selected", "true");
  });

  it("does not navigate when the open project is clicked again", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ id: "p1", name: "Летний запуск" })])),
    );
    setup("/projects/p1");

    const row = await screen.findByText("Летний запуск");
    await userEvent.click(row);

    expect(screen.getByText("Летний запуск")).toBe(row);
  });

  it("marks a row with the colour of its priority", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ name: "Летний запуск", priority: "CRITICAL" })])),
    );
    setup();

    expect(await screen.findByText("Приоритет: Очень важно")).toBeInTheDocument();
  });

  it("offers every priority on a right click", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () => HttpResponse.json([aProject({ name: "Летний запуск" })])),
    );
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));

    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "Очень важно",
      "Есть срочные задачи",
      "В работе, ждём результата",
      "Нет задач",
      "Новый",
    ]);
  });

  it("shows which priority is the current one", async () => {
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ name: "Летний запуск", priority: "IDLE" })])),
    );
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));

    expect(await screen.findByRole("menuitemradio", { name: "Нет задач" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("saves the chosen priority", async () => {
    let sent: Record<string, unknown> | undefined;
    server.use(
      mock.get("/api/clients", () => HttpResponse.json([aClient({ name: "Acme" })])),
      mock.get("/api/projects", () =>
        HttpResponse.json([aProject({ id: "p1", name: "Летний запуск" })])),
      mock.patch("/api/projects/p1", async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(aProject({ id: "p1", priority: "URGENT" }));
      }),
    );
    setup();

    fireEvent.contextMenu(await screen.findByText("Летний запуск"));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Есть срочные задачи" }));

    await waitFor(() => expect(sent).toEqual({ priority: "URGENT" }));
  });
});
