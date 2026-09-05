import { http as mock, HttpResponse, delay } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { CrmPage } from "@/pages/crm/index.js";

const capabilities = { create: true, update: true, delete: true };

const aLead = (fields: Record<string, unknown>) => ({
  id: "lead-1", orgId: "org-1", clientId: null, name: "Анна", company: null,
  phone: null, email: null, telegram: null, website: null, source: null, notes: null,
  stage: "NEW", position: 0, createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z", ...fields,
});

const boards = (...keys: { key: string; label: string }[]) =>
  mock.get("/api/crm/boards", () => HttpResponse.json(keys.map((board) => ({ ...board, capabilities }))));

const setup = (route = "/crm") => renderWithProviders(<CrmPage />, { route });

describe("the CRM board selector", () => {
  it("offers agency staff every board they reach, agency first", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }, { key: "client-1", label: "Ромашка" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup();

    const selector = await screen.findByLabelText("Воронка");
    expect(selector).toHaveTextContent("Агентство");
    await userEvent.click(selector);
    expect(screen.getAllByRole("option").map((option) => option.textContent))
      .toEqual(["Агентство", "Ромашка"]);
  });

  it("leaves out a client the API does not offer, so a project-only grant sees no board for it", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }, { key: "client-2", label: "Василёк" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup();

    await userEvent.click(await screen.findByLabelText("Воронка"));
    expect(screen.getByRole("option", { name: "Василёк" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ромашка" })).not.toBeInTheDocument();
  });

  it("opens a customer straight onto their own board, with nothing to choose between", async () => {
    server.use(
      boards({ key: "client-1", label: "Ромашка" }),
      mock.get("/api/crm/boards/client-1/leads", () => HttpResponse.json([aLead({ name: "Свой лид" })])),
    );
    setup();

    expect(await screen.findByText("Свой лид")).toBeInTheDocument();
    expect(screen.queryByLabelText("Воронка")).not.toBeInTheDocument();
  });

  it("remembers the chosen board in the address", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }, { key: "client-1", label: "Ромашка" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup("/crm?board=client-1");

    expect(await screen.findByLabelText("Воронка")).toHaveTextContent("Ромашка");
  });

  it("says so when the address names a board the member cannot reach", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }),
      mock.get("/api/crm/boards/:board/leads", () => HttpResponse.json([])),
    );
    setup("/crm?board=client-9");

    expect(await screen.findByText("Воронка недоступна")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить лид" })).not.toBeInTheDocument();
  });
});

describe("the CRM board while it loads and when it fails", () => {
  it("keeps every stage on screen while the leads are still on their way", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }),
      mock.get("/api/crm/boards/:board/leads", async () => {
        await delay(60);
        return HttpResponse.json([]);
      }),
    );
    setup();

    expect(await screen.findByTestId("crm-loading")).toBeInTheDocument();
    for (const stage of ["Новый лид", "Выигран", "Отложен"]) {
      expect(screen.getByRole("region", { name: stage })).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.queryByTestId("crm-loading")).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "Новый лид" })).toBeInTheDocument();
  });

  it("floats the loader over the board rather than replacing it", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }),
      mock.get("/api/crm/boards/:board/leads", async () => {
        await delay(60);
        return HttpResponse.json([]);
      }),
    );
    setup();

    const layer = await screen.findByTestId("crm-loading");
    expect(layer.className).toMatch(/\bfixed\b/);
    expect(layer.className).toMatch(/\binset-0\b/);
    expect(layer.className).toMatch(/place-items-center/);
    expect(layer.className).toMatch(/pointer-events-none/);
    expect(layer).toContainElement(screen.getByText("Загрузка…"));
    expect(screen.getByRole("region", { name: "Новый лид" })).toBeInTheDocument();
  });

  it("shows no loader when coming back to a board it already holds", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }, { key: "client-1", label: "Ромашка" }),
      mock.get("/api/crm/boards/agency/leads", () => HttpResponse.json([aLead({ name: "Анна" })])),
      mock.get("/api/crm/boards/client-1/leads", () => HttpResponse.json([])),
    );
    setup();

    await screen.findByText("Анна");
    const selector = screen.getByLabelText("Воронка");
    await userEvent.click(selector);
    await userEvent.click(screen.getByRole("option", { name: "Ромашка" }));
    await waitFor(() => expect(screen.queryByText("Анна")).not.toBeInTheDocument());

    await userEvent.click(selector);
    await userEvent.click(screen.getByRole("option", { name: "Агентство" }));

    expect(screen.queryByTestId("crm-loading")).not.toBeInTheDocument();
    expect(screen.getByText("Анна")).toBeInTheDocument();
  });

  it("leaves the previous board's stages standing while the next one loads", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }, { key: "client-1", label: "Ромашка" }),
      mock.get("/api/crm/boards/agency/leads", () => HttpResponse.json([aLead({ name: "Анна" })])),
      mock.get("/api/crm/boards/client-1/leads", async () => {
        await delay(60);
        return HttpResponse.json([]);
      }),
    );
    setup();

    await screen.findByText("Анна");
    await userEvent.click(screen.getByLabelText("Воронка"));
    await userEvent.click(screen.getByRole("option", { name: "Ромашка" }));

    expect(screen.getByRole("region", { name: "Новый лид" })).toBeInTheDocument();
    expect(await screen.findAllByText("Нет лидов")).toHaveLength(8);
  });

  it("reports leads it could not load", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }),
      mock.get("/api/crm/boards/:board/leads", () =>
        HttpResponse.json({ error: { message: "no" } }, { status: 500 })),
    );
    setup();

    expect(await screen.findByText("Не удалось загрузить лиды")).toBeInTheDocument();
  });

  it("ignores a board's late answer once another board is chosen", async () => {
    server.use(
      boards({ key: "agency", label: "Агентство" }, { key: "client-1", label: "Ромашка" }),
      mock.get("/api/crm/boards/agency/leads", async () => {
        await delay(80);
        return HttpResponse.json([aLead({ name: "Поздний агентский" })]);
      }),
      mock.get("/api/crm/boards/client-1/leads", () =>
        HttpResponse.json([aLead({ id: "lead-2", clientId: "client-1", name: "Клиентский" })])),
    );
    setup();

    await userEvent.click(await screen.findByLabelText("Воронка"));
    await userEvent.click(screen.getByRole("option", { name: "Ромашка" }));
    expect(await screen.findByText("Клиентский")).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(screen.queryByText("Поздний агентский")).not.toBeInTheDocument();
  });
});
