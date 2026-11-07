import { useState } from "react";
import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { aLead } from "@test/shared/fixtures.js";
import type { Lead } from "@/entities/lead/index.js";
import { DEFAULT_VIEW, type ViewState } from "@/features/lead-view-options/index.js";
import { CrmBoard } from "@/widgets/crm-board/index.js";

const capabilities = { create: true, update: true, delete: true };
const readOnly = { create: false, update: false, delete: false };
const BOARD = "/api/crm/boards/project-1";

const COLUMNS = [
  { id: "NEW", kind: "FIXED", name: "Новый", position: 0, color: "blue" },
  { id: "QUALIFIED", kind: "FIXED", name: "Квалифицированный", position: 1, color: "purple" },
  { id: "TARGET", kind: "FIXED", name: "Целевой", position: 2, color: "orange" },
  { id: "PROPOSAL", kind: "FIXED", name: "КП", position: 3, color: "green" },
  { id: "col-1", kind: "CUSTOM", name: "Встреча", position: 0, color: "teal" },
];

const LEADS = [
  aLead({ id: "a", name: "Анна", stage: "NEW", position: 0, amount: "50000.0000", assigneeId: "m1" }),
  aLead({ id: "b", name: "Борис", stage: "NEW", position: 1, amount: "30000.0000", assigneeId: "m2" }),
  aLead({ id: "c", name: "Вера", stage: "NEW", position: 2 }),
  aLead({ id: "d", name: "Глеб", stage: "TARGET", position: 0 }),
];

function board(leads: Lead[] = LEADS) {
  server.use(
    mock.get(`${BOARD}/leads`, () => HttpResponse.json(leads)),
    mock.get(`${BOARD}/columns`, () => HttpResponse.json(COLUMNS)),
  );
}

function Harness({ view = DEFAULT_VIEW, caps = capabilities, onOpen = () => {}, onStage }: { view?: ViewState; caps?: typeof capabilities; onOpen?: (lead: Lead) => void; onStage?: (stage: string | null) => void }) {
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  return (
    <CrmBoard boardKey="project-1" capabilities={caps} view={view} fields={[]} creatingIn={creatingIn} onCreatingChange={(stage) => { setCreatingIn(stage); onStage?.(stage); }} onOpen={onOpen} />
  );
}

const column = (name: string) => screen.getByRole("region", { name });

describe("column headers", () => {
  it("shows each column's colored pill, lead count and amount sum", async () => {
    board();
    renderWithProviders(<Harness />, { route: "/crm" });

    await screen.findByText("Анна");
    const fresh = column("Новый");
    expect(within(fresh).getByText("Новый", { selector: "span[data-color]" })).toHaveAttribute("data-color", "blue");
    expect(within(fresh).getByTestId("crm-count-NEW")).toHaveTextContent("3");
    expect(within(fresh).getByTestId("crm-sum-NEW")).toHaveTextContent("80 тыс.");
    expect(within(column("Целевой")).getByTestId("crm-count-TARGET")).toHaveTextContent("1");
    expect(within(column("Целевой")).queryByTestId("crm-sum-TARGET")).toBeNull();
    expect(within(column("Встреча")).getByText("Встреча")).toHaveAttribute("data-color", "teal");
  });

  it("counts and sums only the leads that pass the filter", async () => {
    board();
    renderWithProviders(<Harness view={{ ...DEFAULT_VIEW, filters: [{ id: "f", field: "assignee", operator: "anyOf", value: ["m1"] }] }} />, { route: "/crm" });

    await screen.findByText("Анна");
    expect(screen.queryByText("Борис")).toBeNull();
    expect(within(column("Новый")).getByTestId("crm-count-NEW")).toHaveTextContent("1");
    expect(within(column("Новый")).getByTestId("crm-sum-NEW")).toHaveTextContent("50 тыс.");
  });

  it("hides columns left without leads when asked", async () => {
    board();
    renderWithProviders(<Harness view={{ ...DEFAULT_VIEW, hideEmpty: true }} />, { route: "/crm" });

    await screen.findByText("Анна");
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual(["Новый", "Целевой"]);
    expect(screen.getByRole("button", { name: "Добавить столбец" })).toBeInTheDocument();
  });

  it("orders cards by the chosen sort", async () => {
    board();
    renderWithProviders(<Harness view={{ ...DEFAULT_VIEW, sort: { field: "amount", direction: "asc" } }} />, { route: "/crm" });

    await screen.findByText("Анна");
    const names = within(column("Новый")).getAllByRole("button", { name: /^Открыть лид/ }).map((card) => card.getAttribute("aria-label"));
    expect(names).toEqual(["Открыть лид: Борис", "Открыть лид: Анна", "Открыть лид: Вера"]);
  });
});

describe("column colors", () => {
  it("recolors a custom column from its menu", async () => {
    board();
    let patched: unknown = null;
    server.use(mock.patch(`${BOARD}/columns/col-1`, async ({ request }) => {
      patched = await request.json();
      return HttpResponse.json(COLUMNS.map((entry) => (entry.id === "col-1" ? { ...entry, color: "purple" } : entry)));
    }));
    renderWithProviders(<Harness />, { route: "/crm" });

    await userEvent.click(await screen.findByRole("button", { name: "Действия столбца: Встреча" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Цвет" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Фиолетовый" }));

    await waitFor(() => expect(patched).toEqual({ color: "purple" }));
    await waitFor(() => expect(within(column("Встреча")).getByText("Встреча", { selector: "span[data-color]" })).toHaveAttribute("data-color", "purple"));
  });

  it("offers no menu on fixed stages", async () => {
    board();
    renderWithProviders(<Harness />, { route: "/crm" });

    await screen.findByText("Анна");
    expect(screen.queryByRole("button", { name: "Действия столбца: Новый" })).toBeNull();
  });
});

describe("creating from a column", () => {
  it("requests the selected stage from the page without creating inline", async () => {
    board();
    const onStage = vi.fn();
    renderWithProviders(<Harness onStage={onStage} />, { route: "/crm" });

    await userEvent.click(await screen.findByRole("button", { name: "Добавить лид в столбец Встреча" }));
    expect(onStage).toHaveBeenCalledWith("col-1");
    expect(screen.queryByLabelText("Имя нового лида")).toBeNull();
  });

  it("offers no creation and no dragging to a guest", async () => {
    board();
    renderWithProviders(<Harness caps={readOnly} />, { route: "/crm" });

    await screen.findByText("Анна");
    expect(screen.queryByRole("button", { name: /Добавить лид в столбец/ })).toBeNull();
    expect(screen.queryByTestId("lead-drag-a")).toBeNull();
  });
});
