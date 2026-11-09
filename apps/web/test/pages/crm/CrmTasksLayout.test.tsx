import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { aLead, aProject, aTask, freezeDate, renderWithProviders, server } from "@test/shared/index.js";
import { CrmLayout, CrmPage } from "@/pages/crm/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import { toIso } from "@/shared/ui/index.js";
freezeDate('2026-09-15T12:00:00');

const capabilities = { create: true, update: true, delete: true };
const readOnly = { create: false, update: false, delete: false };

const posted: Array<Record<string, unknown>> = [];
const asked: string[] = [];

function visit(board = capabilities) {
  server.use(
    mock.get("/api/crm/boards", () => HttpResponse.json([
      { key: "project-1", label: "Сайт", clientId: "client-1", clientName: "Ромашка", capabilities: board },
    ])),
    mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json([
      aLead({ id: "a", name: "Анна", projectId: "project-1" }),
      aLead({ id: "b", name: "Борис", projectId: "project-1" }),
    ])),
  );
  return renderWithProviders(<Routes><Route path="/crm" element={<CrmLayout />}><Route index element={<CrmPage />} /></Route></Routes>, { route: "/crm" });
}

beforeEach(() => {
  posted.length = 0;
  asked.length = 0;
  useModuleMemory.setState({ crmViews: {}, boards: {} });
  server.use(
    mock.get("/api/projects", () => HttpResponse.json([aProject({ id: "project-1" })])),
    mock.get("/api/members", () => HttpResponse.json([])),
    mock.get("/api/tasks", ({ request }) => {
      asked.push(new URL(request.url).search);
      return HttpResponse.json([
        aTask({ id: "t1", title: "Позвонить Анне", dueDate: toIso(new Date()), leadId: "a", lead: { id: "a", name: "Анна", boardKey: "project-1" } }),
      ]);
    }),
    mock.post("/api/tasks", async ({ request }) => {
      posted.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(aTask({ id: "new", leadId: "b", lead: { id: "b", name: "Борис", boardKey: "project-1" } }), { status: 201 });
    }),
  );
});

const chooseTasks = async () =>
  userEvent.click(within(await screen.findByRole("radiogroup", { name: "Раскладка" })).getByRole("radio", { name: "Задачи" }));

describe("the tasks layout of a CRM board", () => {
  it("asks only for the tasks of the selected board", async () => {
    visit();
    await chooseTasks();
    await screen.findByText("Позвонить Анне");

    expect(asked.some((search) => search.includes("scope=crm") && search.includes("projectId=project-1"))).toBe(true);
  });

  it("creates a task for a lead of the board, offering only that board's leads", async () => {
    visit();
    await chooseTasks();
    await userEvent.click(await screen.findByRole("button", { name: "Новая задача" }));
    await userEvent.type(await screen.findByLabelText("Название"), "Выслать КП");
    await userEvent.click(await screen.findByRole("combobox", { name: "Лид" }));

    expect(await screen.findByRole("option", { name: "Анна" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Борис" }));
    await userEvent.click(screen.getByRole("button", { name: "Создать задачу" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ title: "Выслать КП", leadId: "b", projectId: "project-1" });
  });

  it("opens the lead panel beside the list from a lead name", async () => {
    visit();
    await chooseTasks();
    await userEvent.click(await screen.findByRole("button", { name: "Открыть лида: Анна" }));

    expect(await screen.findByRole("complementary", { name: "Анна" })).toBeInTheDocument();
    expect(screen.getByText("Позвонить Анне")).toBeInTheDocument();
  });

  it("shows a guest the layout tabs and the list", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Гость", email: "g@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role: "GUEST",
      clientIds: [],
    })));
    visit(readOnly);
    await chooseTasks();

    expect(await screen.findByText("Позвонить Анне")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Новая задача" })).toBeNull();
  });
});
