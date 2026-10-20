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
        (query.get("inProject") !== "true" || event.projectId !== null)
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

    expect(lines()).toEqual(["Проект «Евроопт»", "Задача «Подготовить отчёт»"]);
    expect(presenceItems()).toHaveLength(0);
    expect(asked[0]!.get("inProject")).toBe("true");
    expect(screen.getByRole("combobox", { name: "Фильтр по проекту" })).toHaveTextContent("Все проекты");
  });

  it("narrows to one project, offering the projects by name", async () => {
    await opened();

    await userEvent.click(screen.getByRole("combobox", { name: "Фильтр по проекту" }));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Все проекты", "Евроопт", "Лода"]);
    await userEvent.click(screen.getByRole("option", { name: "Лода" }));

    await waitFor(() => expect(lines()).toEqual(["Задача «Подготовить отчёт»"]));
    expect(asked.at(-1)!.get("projectId")).toBe(LODA);
    expect(within(itemOf("Задача")).queryByText("· Лода")).not.toBeInTheDocument();
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
    const task = itemOf("Задача");
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
