import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { CrmPage } from "@/pages/crm/index.js";

const capabilities = { create: true, update: true, delete: true };
const readOnly = { create: false, update: false, delete: false };

const FIXED = [
  { id: "NEW", kind: "FIXED", name: "Новый", position: 0 },
  { id: "QUALIFIED", kind: "FIXED", name: "Квалифицированный", position: 1 },
  { id: "TARGET", kind: "FIXED", name: "Целевой", position: 2 },
  { id: "PROPOSAL", kind: "FIXED", name: "КП", position: 3 },
];

const custom = (id: string, name: string, position: number) => ({ id, kind: "CUSTOM", name, position });

const aLead = (id: string, stage: string, position: number) => ({
  id, orgId: "org-1", clientId: null, name: `Лид ${id}`, company: null, phone: null, email: null,
  website: null, source: null, notes: null, projectId: null, campaignId: null, adId: null,
  origin: "MANUAL", ad: null, metaSource: null, stage, position,
  createdAt: "2026-09-05T00:00:00.000Z", updatedAt: "2026-09-05T00:00:00.000Z",
});

function board(options: { columns?: unknown[]; leads?: unknown[]; caps?: typeof capabilities } = {}) {
  const state = { columns: [...FIXED, ...(options.columns ?? [])] };
  server.use(
    mock.get("/api/crm/boards", () => HttpResponse.json([{ key: "agency", label: "Агентство", capabilities: options.caps ?? capabilities }])),
    mock.get("/api/crm/boards/agency/leads", () => HttpResponse.json(options.leads ?? [])),
    mock.get("/api/crm/boards/agency/columns", () => HttpResponse.json(state.columns)),
  );
  return state;
}

const setup = () => renderWithProviders(<CrmPage />, { route: "/crm" });

const columnNames = () =>
  screen.getAllByRole("region")
    .filter((region) => region.dataset.testid?.startsWith("crm-column-"))
    .map((region) => region.getAttribute("aria-label"));

describe("the columns of a CRM board", () => {
  it("shows the four fixed stages, then the board's own columns, then a place to add one", async () => {
    board({ columns: [custom("col-1", "Встреча", 0), custom("col-2", "Договор", 1)] });
    setup();

    await screen.findByRole("region", { name: "Договор" });
    expect(columnNames()).toEqual(["Новый", "Квалифицированный", "Целевой", "КП", "Встреча", "Договор"]);
    expect(screen.getByRole("button", { name: "Добавить столбец" })).toBeInTheDocument();
  });

  it("creates a column from the placeholder and shows it after the others", async () => {
    const state = board();
    let posted: unknown;
    server.use(
      mock.post("/api/crm/boards/agency/columns", async ({ request }) => {
        posted = await request.json();
        const column = custom("col-9", "Договор", 0);
        state.columns = [...state.columns, column];
        return HttpResponse.json(column, { status: 201 });
      }),
    );
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Добавить столбец" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Название столбца"), "  Договор ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(posted).toEqual({ name: "Договор" }));
    expect(await screen.findByRole("region", { name: "Договор" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("refuses a blank name or one the board already has, in any letter case", async () => {
    board({ columns: [custom("col-1", "Встреча", 0)] });
    let posted = false;
    server.use(mock.post("/api/crm/boards/agency/columns", () => { posted = true; return HttpResponse.json({}, { status: 201 }); }));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Добавить столбец" }));
    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText("Название столбца");

    await userEvent.click(within(dialog).getByRole("button", { name: "Создать" }));
    expect(await within(dialog).findByText("Введите название столбца")).toBeInTheDocument();

    await userEvent.type(field, "целевой");
    await userEvent.click(within(dialog).getByRole("button", { name: "Создать" }));
    expect(await within(dialog).findByText("На доске уже есть столбец с таким названием")).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.type(field, "ВСТРЕЧА");
    await userEvent.click(within(dialog).getByRole("button", { name: "Создать" }));
    expect(await within(dialog).findByText("На доске уже есть столбец с таким названием")).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  it("renames a custom column and offers no menu on fixed stages", async () => {
    board({ columns: [custom("col-1", "Встреча", 0)] });
    let patched: unknown;
    server.use(mock.patch("/api/crm/boards/agency/columns/col-1", async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json([...FIXED, custom("col-1", "Встреча назначена", 0)]);
    }));
    setup();

    await screen.findByRole("region", { name: "Встреча" });
    expect(screen.queryByRole("button", { name: "Действия столбца: Новый" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Действия столбца: Встреча" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Переименовать" }));

    const dialog = await screen.findByRole("dialog");
    const field = within(dialog).getByLabelText("Название столбца");
    expect(field).toHaveValue("Встреча");
    await userEvent.clear(field);
    await userEvent.type(field, "Встреча назначена");
    await userEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(patched).toEqual({ name: "Встреча назначена" }));
  });

  it("disables a move only at the very start or end of the whole board", async () => {
    board({ columns: [custom("col-1", "Встреча", 0), custom("col-2", "Договор", 1)] });
    server.use(mock.patch("/api/crm/boards/agency/columns/:id", () => HttpResponse.json(FIXED)));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Действия столбца: Встреча" }));
    expect(await screen.findByRole("menuitem", { name: "Сдвинуть влево" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Сдвинуть вправо" })).not.toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Escape}");

    await userEvent.click(await screen.findByRole("button", { name: "Действия столбца: Договор" }));
    expect(await screen.findByRole("menuitem", { name: "Сдвинуть вправо" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Сдвинуть влево" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("moves a column across a fixed stage, indexing against the whole board", async () => {
    board({ columns: [custom("col-1", "Встреча", 0), custom("col-2", "Договор", 1)] });
    const patched: Array<{ id: string; body: unknown }> = [];
    server.use(mock.patch("/api/crm/boards/agency/columns/:id", async ({ params, request }) => {
      patched.push({ id: String(params.id), body: await request.json() });
      return HttpResponse.json([FIXED[0], custom("col-1", "Встреча", 0), ...FIXED.slice(1), custom("col-2", "Договор", 0)]);
    }));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Действия столбца: Встреча" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Сдвинуть влево" }));
    await waitFor(() => expect(patched).toEqual([{ id: "col-1", body: { position: 3 } }]));
  });

  it("moves a column past the first fixed stage to the very start of the board", async () => {
    board();
    server.use(
      mock.get("/api/crm/boards/agency/columns", () =>
        HttpResponse.json([FIXED[0], custom("col-1", "Встреча", 0), FIXED[1], FIXED[2], FIXED[3]])),
    );
    let patched: unknown;
    server.use(mock.patch("/api/crm/boards/agency/columns/:id", async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json([custom("col-1", "Встреча", 0), ...FIXED]);
    }));
    setup();

    await userEvent.click(await screen.findByRole("button", { name: "Действия столбца: Встреча" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Сдвинуть влево" }));
    await waitFor(() => expect(patched).toEqual({ position: 0 }));
  });

  it("deletes a column only after confirming how many leads it holds", async () => {
    board({
      columns: [custom("col-1", "Встреча", 0)],
      leads: [aLead("a", "col-1", 0), aLead("b", "col-1", 1), aLead("c", "col-1", 2), aLead("d", "NEW", 0)],
    });
    let deleted = false;
    server.use(mock.delete("/api/crm/boards/agency/columns/col-1", () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
    setup();

    await screen.findByText("Лид a");
    await userEvent.click(screen.getByRole("button", { name: "Действия столбца: Встреча" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Удалить" }));
    const confirmation = await screen.findByRole("alertdialog");
    expect(confirmation).toHaveTextContent("Лидов в столбце: 3");
    expect(confirmation).toHaveTextContent("«Новый»");

    await userEvent.click(within(confirmation).getByRole("button", { name: "Отмена" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(deleted).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Действия столбца: Встреча" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Удалить" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Удалить столбец" }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it("offers guests no way to change columns", async () => {
    board({ columns: [custom("col-1", "Встреча", 0)], caps: readOnly });
    setup();

    await screen.findByRole("region", { name: "Встреча" });
    expect(screen.queryByRole("button", { name: "Добавить столбец" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Действия столбца: Встреча" })).not.toBeInTheDocument();
  });

  it("places leads of a custom column in that column", async () => {
    board({ columns: [custom("col-1", "Встреча", 0)], leads: [aLead("a", "col-1", 0), aLead("b", "NEW", 0)] });
    setup();

    const meeting = await screen.findByRole("region", { name: "Встреча" });
    expect(await within(meeting).findByText("Лид a")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Новый" })).getByText("Лид b")).toBeInTheDocument();
  });
});
