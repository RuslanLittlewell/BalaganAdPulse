import { http as mock, HttpResponse, delay } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { CrmPage } from "@/pages/crm/index.js";

const capabilities = { create: true, update: true, delete: true };

const aLead = (fields: Record<string, unknown>) => ({
  id: "lead-1", orgId: "org-1", projectId: "project-1", project: { id: "project-1", clientId: "client-1", name: "Сайт" }, tags: [], name: "Анна", company: null,
  phone: null, email: null, telegram: null, website: null, source: null, notes: null,
  stage: "NEW", position: 0, createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z", ...fields,
});

const boards = (...keys: { key: string; label: string; clientName?: string }[]) =>
  mock.get("/api/crm/boards", () => HttpResponse.json(keys.map((board) => ({ ...board, capabilities }))));

const setup = (route = "/crm") => renderWithProviders(<CrmPage />, { route });

describe("the CRM board selector", () => {
  const asRole = (role: string) => mock.get("/api/auth/me", () => HttpResponse.json({
    user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
    organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
    role,
    clientIds: role === "CLIENT" ? ["client-1"] : [],
  }));

  it("offers every project board the member reaches, each named by project with its client beside it", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт", clientName: "Ромашка" }, { key: "project-2", label: "Реклама", clientName: "Ромашка" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup();

    const selector = await screen.findByLabelText("Воронка");
    expect(selector).toHaveTextContent("Сайт");
    await userEvent.click(selector);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(within(options[0]).getByText("Сайт")).toBeInTheDocument();
    expect(within(options[0]).getByText("Ромашка")).toBeInTheDocument();
    expect(within(options[1]).getByText("Реклама")).toBeInTheDocument();
  });

  it("offers no agency board", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт", clientName: "Ромашка" }, { key: "project-2", label: "Реклама", clientName: "Ромашка" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup();

    await userEvent.click(await screen.findByLabelText("Воронка"));
    expect(screen.queryByRole("option", { name: /Агентство|Agency/ })).not.toBeInTheDocument();
  });

  it("opens a member with one board straight onto it, with nothing to choose between", async () => {
    server.use(
      asRole("CLIENT"),
      boards({ key: "project-1", label: "Сайт", clientName: "Ромашка" }),
      mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json([aLead({ name: "Свой лид" })])),
    );
    setup();

    expect(await screen.findByText("Свой лид")).toBeInTheDocument();
    expect(screen.queryByLabelText("Воронка")).not.toBeInTheDocument();
  });

  it("lets a customer with several projects choose between their boards", async () => {
    server.use(
      asRole("CLIENT"),
      boards({ key: "project-1", label: "Сайт", clientName: "Ромашка" }, { key: "project-2", label: "Реклама", clientName: "Ромашка" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup();

    await userEvent.click(await screen.findByLabelText("Воронка"));
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("remembers the chosen board in the address", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт", clientName: "Ромашка" }, { key: "project-2", label: "Реклама", clientName: "Ромашка" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup("/crm?board=project-2");

    expect(await screen.findByLabelText("Воронка")).toHaveTextContent("Реклама");
  });

  it("says so when the address names a board the member cannot reach", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт", clientName: "Ромашка" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup("/crm?board=project-9");

    expect(await screen.findByText("Воронка недоступна")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить лид" })).not.toBeInTheDocument();
  });

  it("says there is no board when the member reaches no project", async () => {
    server.use(boards());
    setup();

    expect(await screen.findByText("Нет проектов, а значит и воронок")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить лид" })).not.toBeInTheDocument();
  });
});

describe("the CRM board while it loads and when it fails", () => {
  it("keeps every stage on screen while the leads are still on their way", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт" }),
      mock.get("/api/crm/boards/:board/leads", async () => {
        await delay(60);
        return HttpResponse.json([]);
      }),
    );
    setup();

    expect(await screen.findByTestId("crm-loading")).toBeInTheDocument();
    for (const stage of ["Новый", "Целевой", "КП"]) {
      expect(screen.getByRole("region", { name: stage })).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.queryByTestId("crm-loading")).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Новый" })).toBeInTheDocument();
  });

  it("shows the loader while keeping the board on screen", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт" }),
      mock.get("/api/crm/boards/:board/leads", async () => {
        await delay(60);
        return HttpResponse.json([]);
      }),
    );
    setup();

    const layer = await screen.findByTestId("crm-loading");
    expect(layer).toContainElement(screen.getByText("Загрузка…"));
    expect(screen.getByRole("region", { name: "Новый" })).toBeInTheDocument();
  });

  it("shows no loader when coming back to a board it already holds", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт" }, { key: "project-2", label: "Реклама" }),
      mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json([aLead({ name: "Анна" })])),
      mock.get("/api/crm/boards/project-2/leads", () => HttpResponse.json([])),
    );
    setup();

    await screen.findByText("Анна");
    const selector = screen.getByLabelText("Воронка");
    await userEvent.click(selector);
    await userEvent.click(screen.getByRole("option", { name: "Реклама" }));
    await waitFor(() => expect(screen.queryByText("Анна")).not.toBeInTheDocument());

    await userEvent.click(selector);
    await userEvent.click(screen.getByRole("option", { name: "Сайт" }));

    expect(screen.queryByTestId("crm-loading")).not.toBeInTheDocument();
    expect(screen.getByText("Анна")).toBeInTheDocument();
  });

  it("leaves the previous board's stages standing while the next one loads", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт" }, { key: "project-2", label: "Реклама" }),
      mock.get("/api/crm/boards/project-1/leads", () => HttpResponse.json([aLead({ name: "Анна" })])),
      mock.get("/api/crm/boards/project-2/leads", async () => {
        await delay(60);
        return HttpResponse.json([]);
      }),
    );
    setup();

    await screen.findByText("Анна");
    await userEvent.click(screen.getByLabelText("Воронка"));
    await userEvent.click(screen.getByRole("option", { name: "Реклама" }));

    expect(screen.getByRole("region", { name: "Новый" })).toBeInTheDocument();
    expect(await screen.findAllByText("Нет лидов")).toHaveLength(4);
  });

  it("reports leads it could not load", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт" }),
      mock.get("/api/crm/boards/:board/leads", () =>
        HttpResponse.json({ error: { message: "no" } }, { status: 500 })),
    );
    setup();

    expect(await screen.findByText("Не удалось загрузить лиды")).toBeInTheDocument();
  });

  it("ignores a board's late answer once another board is chosen", async () => {
    server.use(
      boards({ key: "project-1", label: "Сайт" }, { key: "project-2", label: "Реклама" }),
      mock.get("/api/crm/boards/project-1/leads", async () => {
        await delay(80);
        return HttpResponse.json([aLead({ name: "Поздний агентский" })]);
      }),
      mock.get("/api/crm/boards/project-2/leads", () =>
        HttpResponse.json([aLead({ id: "lead-2", clientId: "client-1", name: "Клиентский" })])),
    );
    setup();

    await userEvent.click(await screen.findByLabelText("Воронка"));
    await userEvent.click(screen.getByRole("option", { name: "Реклама" }));
    expect(await screen.findByText("Клиентский")).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(screen.queryByText("Поздний агентский")).not.toBeInTheDocument();
  });
});
