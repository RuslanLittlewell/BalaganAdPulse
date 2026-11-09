import { http as mock, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { aLead, aProject, aTask, renderWithProviders, server } from "@test/shared/index.js";
import { TasksPage } from "@/pages/tasks/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import { toIso } from "@/shared/ui/index.js";

const capabilities = { create: true, update: true, delete: true };

const leadTask = aTask({
  id: "lead-task",
  title: "Перезвонить Анне",
  leadId: "lead-1",
  lead: { id: "lead-1", name: "Анна", boardKey: "project-1" },
  dueDate: toIso(new Date()),
});
const laterTask = aTask({
  id: "later-task",
  title: "Выслать КП Борису",
  leadId: "lead-2",
  lead: { id: "lead-2", name: "Борис", boardKey: "project-1" },
  dueDate: toIso(new Date()),
});
const plain = aTask({ id: "plain-task", title: "Обычная задача" });

const asked: string[] = [];
const posted: Array<Record<string, unknown>> = [];

function sessionAs(role: string) {
  server.use(mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Админ", email: "a@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    clientIds: [],
  })));
}

beforeEach(() => {
  asked.length = 0;
  posted.length = 0;
  useModuleMemory.setState({ taskViews: {} });
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", ({ request }) => {
      const query = new URL(request.url).searchParams;
      asked.push(query.toString());
      return HttpResponse.json(query.get("scope") === "crm" ? [laterTask, leadTask] : [plain]);
    }),
    mock.post("/api/tasks", async ({ request }) => {
      posted.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ ...leadTask, id: "created" }, { status: 201 });
    }),
    mock.get("/api/crm/boards", () => HttpResponse.json([{ key: "project-1", label: "Сайт", clientId: "client-1", clientName: "Ромашка", capabilities }])),
    mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json([
      aLead({ id: "lead-1", name: "Анна", projectId: "project-1" }),
      aLead({ id: "lead-2", name: "Борис", projectId: "project-1" }),
    ])),
  );
});

const setup = () => renderWithProviders(<TasksPage />, { route: "/tasks" });

async function openCrm() {
  await userEvent.click(await screen.findByRole("radio", { name: "CRM" }));
}

describe("the CRM view of the task manager", () => {
  it("offers CRM beside the other views and asks for lead tasks only once it is chosen", async () => {
    setup();
    await screen.findByText("Обычная задача");
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Канбан", "Календарь", "Созвоны", "CRM"]);
    expect(asked.some((query) => query.includes("scope=crm"))).toBe(false);

    await openCrm();
    await screen.findByText("Перезвонить Анне");
    expect(asked.some((query) => query.includes("scope=crm"))).toBe(true);
  });

  it("shows the tasks of leads on the week calendar with their lead names, and nothing else", async () => {
    setup();
    await openCrm();
    await screen.findByText("Перезвонить Анне");

    expect(screen.getByRole("button", { name: "Следующая неделя" })).toBeInTheDocument();
    expect(screen.getByText("Выслать КП Борису")).toBeInTheDocument();
    expect(screen.queryByText("Обычная задача")).toBeNull();
    expect(screen.getByRole("button", { name: "Открыть лида: Анна" })).toBeInTheDocument();
  });

  it("opens the task dialog from a task", async () => {
    setup();
    await openCrm();
    await userEvent.click(await screen.findByRole("button", { name: "Открыть задачу: Перезвонить Анне" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("task-lead-name")).toHaveTextContent("Анна");
  });

  it("refuses to create a task without a lead", async () => {
    setup();
    await openCrm();
    await userEvent.click(await screen.findByRole("button", { name: "Новая задача" }));
    await userEvent.type(await screen.findByLabelText("Название"), "Позвонить");
    await userEvent.click(screen.getByRole("button", { name: "Создать задачу" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Выберите лида");
    expect(posted).toEqual([]);
  });

  it("creates a task for the lead picked in the form", async () => {
    setup();
    await openCrm();
    await userEvent.click(await screen.findByRole("button", { name: "Новая задача" }));
    await userEvent.type(await screen.findByLabelText("Название"), "Позвонить");
    await userEvent.click(await screen.findByRole("combobox", { name: "Лид" }));
    await userEvent.click(await screen.findByRole("option", { name: "Борис · Сайт" }));
    await userEvent.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ title: "Позвонить", leadId: "lead-2", projectId: "project-1", dueDate: toIso(new Date()) });
  });

  it("offers a guest the list and no create button", async () => {
    sessionAs("GUEST");
    setup();
    await openCrm();

    expect(await screen.findByText("Перезвонить Анне")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Новая задача" })).toBeNull();
  });

  it("remembers the chosen view", async () => {
    const first = setup();
    await openCrm();
    await screen.findByText("Перезвонить Анне");
    first.unmount();

    setup();
    expect(await screen.findByText("Перезвонить Анне")).toBeInTheDocument();
  });
});
