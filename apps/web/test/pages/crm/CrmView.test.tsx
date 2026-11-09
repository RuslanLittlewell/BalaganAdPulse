import { http as mock, HttpResponse } from "msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { aLead, aTask, freezeDate, renderWithProviders, server } from "@test/shared/index.js";
import { useCrmViews } from "@/features/lead-view-options/index.js";
import { CrmLayout, CrmPage } from "@/pages/crm/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import { toIso } from "@/shared/ui/index.js";
freezeDate('2026-09-15T12:00:00');

const capabilities = { create: true, update: true, delete: true };

const LEADS = [
  aLead({ id: "a", name: "Анна", stage: "NEW", position: 0, amount: "50000.0000", company: { id: "c1", name: "Ромашка", website: null }, assigneeId: "m1", assignee: { id: "m1", name: "Мария", image: null }, customValues: { segment: "o1" } }),
  aLead({ id: "b", name: "Борис", stage: "NEW", position: 1, amount: "5000.0000", company: { id: "c2", name: "Лютик", website: null }, assigneeId: "m2", assignee: { id: "m2", name: "Пётр", image: null }, customValues: { segment: "o2" } }),
  aLead({ id: "c", name: "Вера", stage: "TARGET", position: 0, company: { id: "c1", name: "Ромашка", website: null } }),
];

const sessionOf = (userId: string) => ({
  user: { id: userId, name: "Админ", email: "a@acme.com", image: null },
  organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
  role: "ADMIN",
  clientIds: [],
});

beforeEach(() => {
  useCrmViews.setState({ views: {} });
  useModuleMemory.setState({ crmViews: {}, boards: {} });
  server.use(
    mock.get("/api/crm/boards", () => HttpResponse.json([
      { key: "project-1", label: "Сайт", clientName: "Ромашка", capabilities },
      { key: "project-2", label: "Реклама", clientName: "Ромашка", capabilities },
    ])),
    mock.get("/api/crm/boards/:board/leads", ({ params }) => HttpResponse.json(params.board === "project-1" ? LEADS : [])),
    mock.get("/api/crm/boards/project-1/fields", () => HttpResponse.json([
      { id: "segment", name: "Сегмент", type: "SELECT", position: 0, options: [{ id: "o1", name: "Опт", color: "blue" }, { id: "o2", name: "Розница", color: "green" }] },
    ])),
  );
});

const setup = () => renderWithProviders(<Routes><Route path="/crm" element={<CrmLayout />}><Route index element={<CrmPage />} /></Route></Routes>, { route: "/crm?board=project-1" });

const arrivedToday = () => `${toIso(new Date())}T12:00:00.000Z`;

const shownNames = () => screen.queryAllByRole("button", { name: /^Открыть лид: / }).map((card) => card.getAttribute("aria-label")!.replace("Открыть лид: ", ""));

async function addFilter(field: string) {
  await userEvent.click(screen.getByRole("button", { name: "Фильтр" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: field }));
}

describe("searching and filtering the board", () => {
  it("keeps only leads matching the search, and clearing the search brings them back", async () => {
    setup();
    await screen.findByText("Анна");

    await userEvent.type(screen.getByRole("searchbox", { name: "Поиск" }), "ромаш");
    await waitFor(() => expect(shownNames()).toEqual(["Анна", "Вера"]));

    await userEvent.clear(screen.getByRole("searchbox", { name: "Поиск" }));
    await waitFor(() => expect(shownNames()).toEqual(["Анна", "Борис", "Вера"]));
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("");
  });

  it("filters by a number with its operator and shows the condition as a chip", async () => {
    setup();
    await screen.findByText("Анна");

    await addFilter("Сумма сделки");
    await userEvent.type(await screen.findByLabelText("Значение"), "10 000");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(shownNames()).toEqual(["Анна"]));
    expect(screen.getByRole("button", { name: "Сумма сделки: не меньше 10000" })).toBeInTheDocument();
  });

  it("filters by a custom list field and by assignee together, then drops a chip", async () => {
    setup();
    await screen.findByText("Анна");

    await addFilter("Сегмент");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Розница" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(shownNames()).toEqual(["Борис"]));

    await addFilter("Ответственный");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Мария" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(shownNames()).toEqual([]));

    await userEvent.click(screen.getByRole("button", { name: "Убрать фильтр: Сегмент: любой из Розница" }));
    await waitFor(() => expect(shownNames()).toEqual(["Анна"]));
  });

  it("changes a condition's operator from its chip", async () => {
    setup();
    await screen.findByText("Анна");

    await addFilter("Организация");
    await userEvent.type(await screen.findByLabelText("Значение"), "Ромаш");
    await userEvent.click(screen.getByLabelText("Условие"));
    await userEvent.click(await screen.findByRole("option", { name: "не содержит" }));
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(shownNames()).toEqual(["Борис"]));
  });
});

describe("sorting and card options", () => {
  it("sorts by amount and shows a removable sort chip", async () => {
    setup();
    await screen.findByText("Анна");

    await userEvent.click(screen.getByRole("button", { name: "Сортировка" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Сумма сделки" }));
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(shownNames()).toEqual(["Борис", "Анна", "Вера"]));
    await userEvent.click(screen.getByRole("button", { name: "Убрать сортировку" }));
    await waitFor(() => expect(shownNames()).toEqual(["Анна", "Борис", "Вера"]));
  });

  it("reorders and hides card fields and hides empty columns", async () => {
    setup();
    await screen.findByText("Анна");

    await userEvent.click(screen.getByRole("button", { name: "Настройки" }));
    await userEvent.click(await screen.findByRole("button", { name: "Поднять поле: Организация" }));
    await userEvent.click(screen.getByRole("switch", { name: "Ответственный" }));
    await userEvent.click(screen.getByRole("switch", { name: "Скрывать пустые колонки" }));
    await userEvent.keyboard("{Escape}");

    const card = screen.getByTestId("lead-card-a");
    expect([...card.querySelectorAll("[data-field]")].map((row) => row.getAttribute("data-field"))).toEqual(["amount", "company", "arrival"]);
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual(["Новый", "Целевой"]);
  });
});

describe("remembering the view", () => {
  it("restores a board's settings and keeps other boards and people apart", async () => {
    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-1"))));
    const first = setup();
    await screen.findByText("Анна");
    await userEvent.type(screen.getByRole("searchbox", { name: "Поиск" }), "Лютик");
    await waitFor(() => expect(shownNames()).toEqual(["Борис"]));

    await userEvent.click(screen.getByLabelText("Воронка"));
    await userEvent.click(screen.getByRole("option", { name: /Реклама/ }));
    await waitFor(() => expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue(""));
    first.unmount();

    const again = setup();
    await waitFor(() => expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("Лютик"));
    again.unmount();

    server.use(mock.get("/api/auth/me", () => HttpResponse.json(sessionOf("user-2"))));
    setup();
    await screen.findByText("Анна");
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("");
  });
});

describe("the tasks layout", () => {
  it("shows only tasks of leads passing the search and opens the lead in the panel", async () => {
    server.use(
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([
        aLead({ id: "a", name: "Анна", company: { id: "c1", name: "Ромашка", website: null } }),
        aLead({ id: "b", name: "Борис", company: { id: "c2", name: "Лютик", website: null } }),
      ])),
      mock.get("/api/tasks", () => HttpResponse.json([
        aTask({ id: "t1", title: "Позвонить Анне", dueDate: toIso(new Date()), leadId: "a", lead: { id: "a", name: "Анна", boardKey: "project-1" } }),
        aTask({ id: "t2", title: "Позвонить Борису", dueDate: toIso(new Date()), leadId: "b", lead: { id: "b", name: "Борис", boardKey: "project-1" } }),
      ])),
    );
    setup();
    await screen.findByText("Анна");

    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Раскладка" })).getByRole("radio", { name: "Задачи" }));
    await screen.findByText("Позвонить Анне");
    await userEvent.type(screen.getByRole("searchbox", { name: "Поиск" }), "Лютик");

    await waitFor(() => expect(screen.queryByText("Позвонить Анне")).toBeNull());
    expect(screen.getByText("Позвонить Борису")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Открыть лида: Борис" }));
    expect(await screen.findByRole("complementary", { name: "Борис" })).toBeInTheDocument();
  });
});

describe("filtering by a period of dates", () => {
  const OCTOBER = [
    aLead({ id: "s", name: "Сентябрьский", createdAt: "2026-09-30T10:00:00.000Z" }),
    aLead({ id: "o1", name: "Первый октябрьский", createdAt: "2026-10-01T10:00:00.000Z" }),
    aLead({ id: "o2", name: "Последний октябрьский", createdAt: "2026-10-31T10:00:00.000Z" }),
    aLead({ id: "n", name: "Ноябрьский", createdAt: "2026-11-01T10:00:00.000Z" }),
  ];

  it("starts on the current month", async () => {
    server.use(mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json(OCTOBER)));
    setup();
    await screen.findByText("Сентябрьский");
    expect(screen.getByLabelText("От:")).toHaveValue("01-09-2026");
    expect(screen.getByLabelText("До:")).toHaveValue("30-09-2026");
    expect(shownNames()).toEqual(["Сентябрьский"]);
  });

  it("counts the leads that arrived in October from the dates in the header", async () => {
    server.use(mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json(OCTOBER)));
    setup();
    await screen.findByText("Сентябрьский");
    fireEvent.change(screen.getByLabelText("От:"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("До:"), { target: { value: "" } });
    await waitFor(() => expect(screen.getByLabelText("Лидов: 4")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("От:"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("До:"), { target: { value: "2026-10-31" } });

    await waitFor(() => expect(shownNames()).toEqual(["Первый октябрьский", "Последний октябрьский"]));
    expect(screen.getByLabelText("Лидов: 2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("От:"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("До:"), { target: { value: "" } });
    await waitFor(() => expect(shownNames()).toHaveLength(4));
    expect(screen.queryByRole("button", { name: /Дата поступления/ })).toBeNull();
  });

  it("filters the table by the same dates", async () => {
    server.use(mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json(OCTOBER)));
    setup();
    await screen.findByText("Сентябрьский");
    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Раскладка" })).getByRole("radio", { name: "Таблица" }));
    await screen.findByRole("table");

    fireEvent.change(screen.getByLabelText("От:"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("До:"), { target: { value: "2026-10-31" } });

    await waitFor(() => expect(screen.queryByText("Сентябрьский")).toBeNull());
    expect(screen.getByText("Первый октябрьский")).toBeInTheDocument();
    expect(screen.queryByText("Ноябрьский")).toBeNull();
  });

  it("tells a reversed period and does not filter by it", async () => {
    server.use(mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json(OCTOBER)));
    setup();
    await screen.findByText("Сентябрьский");

    fireEvent.change(screen.getByLabelText("От:"), { target: { value: "2026-10-31" } });
    fireEvent.change(screen.getByLabelText("До:"), { target: { value: "2026-10-01" } });

    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("«До» раньше «От»");
    expect(shownNames()).toHaveLength(4);
  });

  it("offers the same period in the filter menu", async () => {
    server.use(mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json(OCTOBER)));
    setup();
    await screen.findByText("Сентябрьский");

    await addFilter("Дата поступления");
    await userEvent.click(await screen.findByLabelText("Условие"));
    expect(await screen.findByRole("option", { name: "в период" })).toBeInTheDocument();
  });
});
