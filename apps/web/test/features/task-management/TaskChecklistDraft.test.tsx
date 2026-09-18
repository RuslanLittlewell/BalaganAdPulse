import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aProject, renderWithProviders, server } from "@test/shared/index.js";
import { TaskFormDialog } from "@/features/task-management/index.js";

const members = [
  { id: "member-1", userId: "u1", name: "Пётр", email: "p@acme.com", image: null, phone: null, telegram: null, role: "MANAGER", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" },
];

let itemRequests = 0;
let created: Record<string, unknown> | null = null;

beforeEach(() => {
  itemRequests = 0;
  created = null;
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1", name: "Летний запуск" })])),
    mock.get("/api/members", () => HttpResponse.json(members)),
    mock.get("/api/campaigns/names", () => HttpResponse.json([])),
    mock.post("/api/tasks/:id/checklist", () => {
      itemRequests += 1;
      return HttpResponse.json({}, { status: 201 });
    }),
    mock.post("/api/tasks", async ({ request }) => {
      created = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: "task-1" }, { status: 201 });
    }),
  );
});

async function creating() {
  const rendered = renderWithProviders(<TaskFormDialog onClose={() => {}} />, { route: "/tasks" });
  await userEvent.click(await screen.findByRole("button", { name: "Чек-лист" }));
  return rendered;
}

const add = async (title: string) => {
  await userEvent.type(await screen.findByLabelText("Новый пункт"), title);
  await userEvent.click(screen.getByRole("button", { name: "Добавить пункт" }));
};

describe("a checklist written before the task exists", () => {
  it("holds the items without asking the server", async () => {
    await creating();
    await add("Повестка");
    await add("Запись");

    expect(await screen.findByRole("checkbox", { name: "Повестка" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Запись" })).toBeInTheDocument();
    expect(itemRequests).toBe(0);
  });

  it("refuses a blank item", async () => {
    await creating();
    await userEvent.click(await screen.findByRole("button", { name: "Добавить пункт" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("ticks and unticks an item of its own", async () => {
    await creating();
    await add("Повестка");

    await userEvent.click(await screen.findByRole("checkbox", { name: "Повестка" }));
    expect(screen.getByRole("checkbox", { name: "Повестка" })).toBeChecked();

    await userEvent.click(screen.getByRole("checkbox", { name: "Повестка" }));
    expect(screen.getByRole("checkbox", { name: "Повестка" })).not.toBeChecked();
    expect(itemRequests).toBe(0);
  });

  it("removes an item of its own", async () => {
    await creating();
    await add("Повестка");
    await add("Запись");

    await userEvent.click((await screen.findAllByRole("button", { name: "Удалить пункт" }))[0]!);
    expect(screen.queryByRole("checkbox", { name: "Повестка" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Запись" })).toBeInTheDocument();
  });

  it("reports how many of its items are ticked", async () => {
    await creating();
    await add("Повестка");
    await add("Запись");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Повестка" }));

    expect(await screen.findByText("1 из 2")).toBeInTheDocument();
  });

  it("goes with the task when it is created", async () => {
    await creating();
    await add("Повестка");
    await add("Запись");

    await userEvent.type(await screen.findByLabelText("Название"), "Созвон");
    await userEvent.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(created).toMatchObject({
      title: "Созвон",
      checklist: [{ title: "Повестка" }, { title: "Запись" }],
    }));
    expect(itemRequests).toBe(0);
  });
});
