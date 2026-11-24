import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { AuditAction, AuditEvent } from "@/entities/audit-event/index.js";
import { ActivityLogModal } from "@/widgets/activity-log-modal/index.js";
import { hookWrapper, server } from "@test/shared/index.js";

const EVROOPT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LODA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BORIS = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MARIA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let sequence = 0;

function auditEvent(fields: Partial<AuditEvent> & { action: AuditAction }): AuditEvent {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    orgId: "22222222-2222-4222-8222-222222222222",
    actorId: MARIA,
    actorName: "Мария",
    actorEmail: "maria@example.com",
    actorRole: "MANAGER",
    entityType: "project",
    entityId: EVROOPT,
    clientId: null,
    projectId: null,
    campaignId: null,
    leadId: null,
    summary: "",
    changes: null,
    requestId: null,
    ip: null,
    userAgent: null,
    createdAt: "2026-10-22T02:30:00.000Z",
    ...fields,
  };
}

const presence = (action: "ONLINE" | "OFFLINE", createdAt: string) => auditEvent({
  action, entityType: "member", entityId: BORIS, actorId: BORIS, actorName: "Борис",
  summary: action === "ONLINE" ? "Came online" : "Went offline", createdAt,
});

const TASK_TYPES = ["task", "task-comment", "task-image", "task-document"];
const CRM_TYPES = ["lead", "lead-column", "lead-field", "lead-note", "crm-company", "crm-person"];
const PEOPLE_TYPES = ["member", "invite"];

const sectionOf = (event: AuditEvent) => {
  const type = event.entityType;
  if (TASK_TYPES.includes(type) && event.leadId === null) return "tasks";
  if (CRM_TYPES.includes(type) || (event.leadId !== null && !PEOPLE_TYPES.includes(type))) return "crm";
  if (PEOPLE_TYPES.includes(type)) return "people";
  return "projects";
};

let events: AuditEvent[];
let asked: URLSearchParams[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T03:00:00.000Z"));
  asked = [];
  events = [
    auditEvent({
      action: "UPDATE", projectId: EVROOPT, summary: "Updated project “Евроопт”",
      changes: [{ field: "Расход", before: 100, after: 125 }],
    }),
    auditEvent({
      action: "CREATE", entityType: "task", projectId: LODA, summary: "Created task “Подготовить отчёт”",
      actorId: BORIS, actorName: "Борис", createdAt: "2026-10-22T01:00:00.000Z",
    }),
    presence("OFFLINE", "2026-10-20T09:05:00.000Z"),
    presence("ONLINE", "2026-10-20T00:00:00.000Z"),
  ];
  server.use(
    http.get("/api/audit", ({ request }) => {
      const query = new URL(request.url).searchParams;
      asked.push(query);
      const items = events.filter((event) =>
        (!query.get("section") || sectionOf(event) === query.get("section"))
        && (!query.get("projectId") || event.projectId === query.get("projectId"))
        && (!query.get("actorId") || event.actorId === query.get("actorId")));
      return HttpResponse.json({ items, nextCursor: null });
    }),
    http.get("/api/audit/actors", () => HttpResponse.json([{ id: BORIS, name: "Борис" }, { id: MARIA, name: "Мария" }])),
    http.get("/api/projects", () => HttpResponse.json([
      { id: LODA, clientId: "c2", name: "Лода", budgetCurrency: "BYN", image: null, avatarPath: null, position: 0, createdAt: "", updatedAt: "" },
      { id: EVROOPT, clientId: "c1", name: "Евроопт", budgetCurrency: "BYN", image: null, avatarPath: null, position: 1, createdAt: "", updatedAt: "" },
    ])),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  render(<ActivityLogModal open onOpenChange={() => undefined} />, { wrapper: hookWrapper() });
}

const lines = () => [...document.querySelectorAll("li[data-action] > div > p")].map((node) => node.textContent);
const presenceItems = () => document.querySelectorAll("li[data-action='ONLINE'], li[data-action='OFFLINE']");
const itemOf = (text: string) => screen.getByText(text).closest("li[data-action]") as HTMLElement;

async function opened() {
  setup();
  await screen.findByText("Проект");
}

async function choose(filter: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: filter }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("the history window", () => {
  it("opens on projects, listing the events tied to a project in Russian", async () => {
    await opened();

    expect(lines()).toEqual(["Проект «Евроопт»"]);
    expect(presenceItems()).toHaveLength(0);
    expect(asked[0]!.get("section")).toBe("projects");
    expect(screen.getByRole("combobox", { name: "Фильтр по проекту" })).toHaveTextContent("Все проекты");
  });

  it("narrows to one project, offering the projects by name", async () => {
    await opened();

    await userEvent.click(screen.getByRole("combobox", { name: "Фильтр по проекту" }));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Все проекты", "Евроопт", "Лода"]);
    await userEvent.click(screen.getByRole("option", { name: "Лода" }));

    await waitFor(() => expect(lines()).toEqual([]));
    expect(asked.at(-1)!.get("projectId")).toBe(LODA);
    expect(asked.at(-1)!.get("section")).toBe("projects");
  });

  it("lists tasks on their own tab, asking for the tasks section", async () => {
    await opened();

    await userEvent.click(screen.getByRole("radio", { name: "Задачи" }));

    await waitFor(() => expect(lines()).toEqual(["Задача «Подготовить отчёт»"]));
    expect(asked.at(-1)!.get("section")).toBe("tasks");
  });

  it("asks for the CRM section on the CRM tab", async () => {
    await opened();

    await userEvent.click(screen.getByRole("radio", { name: "CRM" }));

    await waitFor(() => expect(asked.at(-1)!.get("section")).toBe("crm"));
  });

  it("lists everything on people by day, coming online and going offline at their time of day", async () => {
    await opened();

    await userEvent.click(screen.getByRole("radio", { name: "Сотрудники" }));

    await waitFor(() => expect(presenceItems()).toHaveLength(2));
    expect(within(screen.getByRole("region", { name: "Сегодня" })).getByText("Задача")).toBeInTheDocument();
    const earlier = screen.getByRole("region", { name: "20 октября" });
    const offline = earlier.querySelector("li[data-action='OFFLINE']") as HTMLElement;
    expect(within(offline).getByText("Борис")).toBeInTheDocument();
    expect(within(offline).getByText("Офлайн")).toBeInTheDocument();
    expect(within(offline).getByText("18:05")).toBeInTheDocument();
    expect(within(offline).queryByText("Went offline")).not.toBeInTheDocument();
    expect(within(earlier.querySelector("li[data-action='ONLINE']") as HTMLElement).getByText("Онлайн")).toBeInTheDocument();
  });

  it("narrows to one person's actions", async () => {
    await opened();
    await userEvent.click(screen.getByRole("radio", { name: "Сотрудники" }));

    await choose("Фильтр по сотруднику", "Борис");

    await waitFor(() => expect(lines()).toEqual(["Задача «Подготовить отчёт»"]));
    expect(presenceItems()).toHaveLength(2);
    expect(asked.at(-1)!.get("actorId")).toBe(BORIS);
  });

  it("keeps a project choice for each type tab apart from the others", async () => {
    await opened();
    await choose("Фильтр по проекту", "Евроопт");
    await userEvent.click(screen.getByRole("radio", { name: "Задачи" }));
    expect(await screen.findByRole("combobox", { name: "Фильтр по проекту" })).toHaveTextContent("Все проекты");
    await choose("Фильтр по проекту", "Лода");

    await userEvent.click(screen.getByRole("radio", { name: "Проекты" }));
    expect(await screen.findByRole("combobox", { name: "Фильтр по проекту" })).toHaveTextContent("Евроопт");
    await userEvent.click(screen.getByRole("radio", { name: "Задачи" }));
    expect(await screen.findByRole("combobox", { name: "Фильтр по проекту" })).toHaveTextContent("Лода");
    await userEvent.click(screen.getByRole("radio", { name: "CRM" }));
    expect(await screen.findByRole("combobox", { name: "Фильтр по проекту" })).toHaveTextContent("Все проекты");
  });

  it("lists a task of a lead on CRM with the lead's events, and not on Задачи", async () => {
    events.push(
      auditEvent({
        action: "CREATE", entityType: "task", projectId: LODA, leadId: "lead-1",
        summary: "Created task “Перезвонить”", createdAt: "2026-10-22T02:00:00.000Z",
      }),
      auditEvent({
        action: "DELETE", entityType: "lead", entityId: "lead-2", projectId: LODA, summary: "DELETE lead",
        changes: { before: { name: "Анна" } } as never, createdAt: "2026-10-22T01:30:00.000Z",
      }),
    );
    await opened();

    await userEvent.click(screen.getByRole("radio", { name: "CRM" }));
    await waitFor(() => expect(lines()).toEqual(["Задача «Перезвонить»", "Лид «Анна»"]));

    await userEvent.click(screen.getByRole("radio", { name: "Задачи" }));
    await waitFor(() => expect(lines()).toEqual(["Задача «Подготовить отчёт»"]));
  });

  it("shows a member's removal on Сотрудники only", async () => {
    events.push(auditEvent({
      action: "DELETE", entityType: "member", entityId: BORIS, summary: "Removed Борис from the organization",
      createdAt: "2026-10-22T02:10:00.000Z",
    }));
    await opened();

    for (const tab of ["Проекты", "Задачи", "CRM"]) {
      await userEvent.click(screen.getByRole("radio", { name: tab }));
      await waitFor(() => expect(asked.at(-1)!.get("section")).toBe({ Проекты: "projects", Задачи: "tasks", CRM: "crm" }[tab]));
      expect(screen.queryByText("Сотрудник")).not.toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole("radio", { name: "Сотрудники" }));

    const removal = (await screen.findByText("Сотрудник")).closest("li[data-action]") as HTMLElement;
    expect(removal).toHaveAttribute("data-action", "DELETE");
    expect(within(removal).getByText(/Борис/)).toBeInTheDocument();
    expect(within(removal).getByText(/удалён из организации/)).toBeInTheDocument();
  });

  it("lists a company without a project under all projects and not once a project is chosen", async () => {
    events.push(auditEvent({
      action: "DELETE", entityType: "crm-company", entityId: "company-1", clientId: "c1", summary: "DELETE company",
      changes: { before: { name: "Лода" } } as never, createdAt: "2026-10-22T02:20:00.000Z",
    }));
    await opened();

    await userEvent.click(screen.getByRole("radio", { name: "CRM" }));
    await waitFor(() => expect(lines()).toEqual(["Компания «Лода»"]));

    await choose("Фильтр по проекту", "Лода");
    await waitFor(() => expect(lines()).toEqual([]));
  });

  it("shows what went with a deleted project and a deleted lead, and nothing for a deletion without counts", async () => {
    events.push(
      auditEvent({
        action: "DELETE", entityType: "project", projectId: LODA, summary: "Deleted project “Лода”",
        changes: { removedWith: { tasks: 12, leads: 30 } } as never, createdAt: "2026-10-22T02:10:00.000Z",
      }),
      auditEvent({
        action: "DELETE", entityType: "lead", entityId: "lead-1", projectId: EVROOPT, summary: "DELETE lead",
        changes: { before: { name: "Анна" }, removedWith: { tasks: 1, notes: 2 } } as never, createdAt: "2026-10-22T02:05:00.000Z",
      }),
      auditEvent({
        action: "DELETE", entityType: "client", entityId: "c9", clientId: "c9", summary: "Deleted client “Пустой”",
        createdAt: "2026-10-22T02:00:00.000Z",
      }),
    );
    setup();

    expect(await screen.findByText("Вместе с проектом удалено: 12 задач, 30 лидов")).toBeInTheDocument();
    expect(within(itemOf("Клиент")).queryByText(/Вместе с/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "CRM" }));
    expect(await screen.findByText("Вместе с лидом удалено: 1 задача, 2 заметки")).toBeInTheDocument();
  });

  it("keeps each tab's choice when switching between them", async () => {
    await opened();
    await choose("Фильтр по проекту", "Евроопт");
    await userEvent.click(screen.getByRole("radio", { name: "Сотрудники" }));
    await choose("Фильтр по сотруднику", "Борис");

    await userEvent.click(screen.getByRole("radio", { name: "Проекты" }));
    expect(await screen.findByRole("combobox", { name: "Фильтр по проекту" })).toHaveTextContent("Евроопт");
    await userEvent.click(screen.getByRole("radio", { name: "Сотрудники" }));

    expect(await screen.findByRole("combobox", { name: "Фильтр по сотруднику" })).toHaveTextContent("Борис");
  });

  it("shows a change with its action, actor, project, values and time, how long ago on hover", async () => {
    await opened();

    const project = itemOf("Проект");
    expect(project).toHaveAttribute("data-action", "UPDATE");
    expect(within(project).getByText("Изменение")).toBeInTheDocument();
    expect(within(project).getByText("Мария")).toBeInTheDocument();
    expect(within(project).getByText(/Расход/).closest("li")).toHaveTextContent("100 → 125");
    expect(within(project).getByText("11:30")).toHaveAttribute("title", "30 минут назад");
    await userEvent.click(screen.getByRole("radio", { name: "Задачи" }));
    const task = await waitFor(() => itemOf("Задача"));
    expect(task).toHaveAttribute("data-action", "CREATE");
    expect(within(task).getByText("Создание")).toBeInTheDocument();
    expect(within(task).getByText("· Лода")).toBeInTheDocument();
  });

  it("shows a summary it cannot read as it is", async () => {
    events.push(auditEvent({
      action: "UPDATE", projectId: EVROOPT, summary: "Изменён день 31 августа", createdAt: "2026-10-22T00:00:00.000Z",
    }));

    setup();

    expect(await screen.findByText("Изменён день 31 августа")).toBeInTheDocument();
  });
});
