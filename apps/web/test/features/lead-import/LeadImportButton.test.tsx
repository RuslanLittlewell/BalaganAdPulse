import { http as mock, HttpResponse } from "msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, server } from "@test/shared/index.js";
import { LeadImportButton } from "@/features/lead-import/index.js";

const BASE = "/api/crm/boards/project-1/imports";
const LINK = "https://docs.google.com/spreadsheets/d/1IQ75C3r1XUbf9xdW/edit#gid=7";
const TABLE = {
  columns: ["name", "phone", "dt_created", "utm_id", "What stage are you at?", "fbclid", "status"],
  rows: [
    ["Gabriela", "+12039521110", "2026-11-20T03:46:21.657Z", "120251441942930251", "Price", "abc", "Qualified"],
    ["Jeff", "+12035091636", "", "120248687922870485", "", "", "В работе"],
  ],
};
const PREVIEW = {
  added: 2,
  skipped: { onBoard: 75, repeated: 0, empty: 0 },
  undated: 1,
  campaigns: [
    { value: "120251441942930251", leads: 1, campaign: { id: "c-ct", name: "US | CT | Leads" } },
    { value: "120248687922870485", leads: 1, campaign: null },
  ],
  statuses: [
    { value: "Qualified", leads: 1, column: { id: "QUALIFIED", name: "Квалифицированный" } },
    { value: "В работе", leads: 1, column: null },
  ],
};
const COLUMNS = [
  { id: "NEW", kind: "FIXED", name: "Новый", position: 0, color: "blue" },
  { id: "QUALIFIED", kind: "FIXED", name: "Квалифицированный", position: 1, color: "purple" },
  { id: "col-measure", kind: "CUSTOM", name: "Замер", position: 2, color: "gray" },
  { id: "TARGET", kind: "FIXED", name: "Целевой", position: 3, color: "orange" },
  { id: "PROPOSAL", kind: "FIXED", name: "КП", position: 4, color: "green" },
];

function serve({ role = "ADMIN", table = () => HttpResponse.json(TABLE) }: { role?: string; table?: () => Response } = {}) {
  const sent: Array<{ path: string; body: unknown }> = [];
  server.use(
    mock.get("/api/auth/me", () => HttpResponse.json({
      user: { id: "user-1", name: "Buyer", email: "buyer@acme.com", image: null },
      organization: { id: "org-1", name: "AdPulse", slug: "adpulse" },
      role,
      clientIds: [],
    })),
    mock.get("/api/projects/project-1/campaigns/names", () => HttpResponse.json([
      { id: "c-ct", name: "US | CT | Leads", channel: "META", status: "PAUSED" },
      { id: "c-oh", name: "US | OH | Leads", channel: "META", status: "PAUSED" },
    ])),
    mock.get("/api/crm/boards/project-1/columns", () => HttpResponse.json(COLUMNS)),
    mock.post(`${BASE}/table`, async ({ request }) => {
      sent.push({ path: "table", body: await request.json() });
      return table();
    }),
    mock.post(`${BASE}/preview`, async ({ request }) => {
      sent.push({ path: "preview", body: await request.json() });
      return HttpResponse.json(PREVIEW);
    }),
    mock.post(BASE, async ({ request }) => {
      sent.push({ path: "run", body: await request.json() });
      return HttpResponse.json({ added: 2, skipped: { onBoard: 75, repeated: 0, empty: 0 } }, { status: 201 });
    }),
  );
  return sent;
}

async function openWithLink(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Импорт" }));
  const dialog = await screen.findByRole("dialog", { name: "Импорт лидов" });
  await user.type(within(dialog).getByLabelText("Ссылка на Google Таблицу"), LINK);
  await user.click(within(dialog).getByRole("button", { name: "Загрузить" }));
  return dialog;
}

describe("the lead import", () => {
  it("is offered to an admin and a client admin only", async () => {
    for (const role of ["MANAGER", "CLIENT", "PARTNER"]) {
      serve({ role });
      const { unmount } = renderWithProviders(<LeadImportButton boardKey="project-1" />);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Импорт" })).not.toBeInTheDocument());
      unmount();
    }
    serve({ role: "CLIENT_ADMIN" });
    renderWithProviders(<LeadImportButton boardKey="project-1" />);

    expect(await screen.findByRole("button", { name: "Импорт" })).toBeInTheDocument();
  });

  it("reads a sheet link, proposes column roles and previews the mapped rows", async () => {
    const user = userEvent.setup();
    const sent = serve();
    renderWithProviders(<LeadImportButton boardKey="project-1" />);

    const dialog = await openWithLink(user);

    expect(await within(dialog).findByRole("combobox", { name: "utm_id" })).toHaveTextContent("Кампания");
    expect(within(dialog).getByRole("combobox", { name: "fbclid" })).toHaveTextContent("Не импортировать");
    expect(within(dialog).getByRole("combobox", { name: "What stage are you at?" })).toHaveTextContent("Ответ на вопрос");
    expect(within(dialog).getByRole("combobox", { name: "status" })).toHaveTextContent("Статус");
    const summary = await within(dialog).findByRole("region", { name: "Итог импорта" });
    expect(within(summary).getByText("Уже есть в CRM").nextSibling).toHaveTextContent("75");
    expect(within(summary).getByText("US | CT | Leads")).toBeInTheDocument();
    expect(sent[0]).toEqual({ path: "table", body: { url: LINK } });
    expect(sent[1]).toMatchObject({
      path: "preview",
      body: { rows: [
        { name: "Gabriela", phone: "+12039521110", submittedAt: "2026-11-20T03:46:21.657Z", campaign: "120251441942930251", status: "Qualified", answers: [{ question: "What stage are you at?", values: ["Price"] }] },
        { name: "Jeff", submittedAt: null, campaign: "120248687922870485", status: "В работе", answers: [] },
      ] },
    });
  });

  it("imports with the campaign chosen for a value that matched none and reports the outcome", async () => {
    const user = userEvent.setup();
    const sent = serve();
    renderWithProviders(<LeadImportButton boardKey="project-1" />);
    const dialog = await openWithLink(user);

    await user.click(await within(dialog).findByRole("combobox", { name: "120248687922870485" }));
    await user.click(await screen.findByRole("option", { name: "US | OH | Leads" }));
    await user.click(within(dialog).getByRole("button", { name: "Импортировать (2)" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent("Добавлено лидов: 2. Пропущено строк: 75.");
    expect(sent.find((entry) => entry.path === "run")?.body).toMatchObject({ choices: [{ value: "120248687922870485", campaignId: "c-oh" }] });
  });

  it("offers a board column for every status, set to the column found or the first one, and imports the picks", async () => {
    const user = userEvent.setup();
    const sent = serve();
    renderWithProviders(<LeadImportButton boardKey="project-1" />);
    const dialog = await openWithLink(user);

    const summary = await within(dialog).findByRole("region", { name: "Итог импорта" });
    expect(within(summary).getByRole("combobox", { name: "Qualified" })).toHaveTextContent("Квалифицированный");
    expect(within(summary).getByRole("combobox", { name: "В работе" })).toHaveTextContent("Новый");
    await user.click(within(summary).getByRole("combobox", { name: "В работе" }));
    await user.click(await screen.findByRole("option", { name: "Замер" }));
    await user.click(within(summary).getByRole("combobox", { name: "Qualified" }));
    await user.click(await screen.findByRole("option", { name: "КП" }));
    await user.click(within(dialog).getByRole("button", { name: "Импортировать (2)" }));

    await within(dialog).findByRole("status");
    expect(sent.find((entry) => entry.path === "run")?.body).toMatchObject({
      placements: [{ value: "В работе", columnId: "col-measure" }, { value: "Qualified", columnId: "PROPOSAL" }],
    });
  });

  it("sends a new preview when a column changes its role", async () => {
    const user = userEvent.setup();
    const sent = serve();
    renderWithProviders(<LeadImportButton boardKey="project-1" />);
    const dialog = await openWithLink(user);

    await user.click(await within(dialog).findByRole("combobox", { name: "utm_id" }));
    await user.click(await screen.findByRole("option", { name: "Не импортировать" }));

    await waitFor(() => expect(sent.filter((entry) => entry.path === "preview")).toHaveLength(2));
    expect(sent.at(-1)).toMatchObject({ body: { rows: [{ campaign: null }, { campaign: null }] } });
  });

  it("says when the sheet is closed", async () => {
    const user = userEvent.setup();
    serve({ table: () => HttpResponse.json({ error: { message: "closed", details: [{ code: "CLOSED" }] } }, { status: 400 }) });
    renderWithProviders(<LeadImportButton boardKey="project-1" />);

    const dialog = await openWithLink(user);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Таблица закрыта. Откройте доступ всем, у кого есть ссылка.");
  });

  it("sends a picked CSV file as text", async () => {
    const user = userEvent.setup();
    const sent = serve();
    renderWithProviders(<LeadImportButton boardKey="project-1" />);
    await user.click(await screen.findByRole("button", { name: "Импорт" }));
    const dialog = await screen.findByRole("dialog", { name: "Импорт лидов" });

    await user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, new File(["Имя;Телефон\nАнна;1\n"], "leads.csv", { type: "text/csv" }));

    await waitFor(() => expect(sent[0]).toEqual({ path: "table", body: { csv: "Имя;Телефон\nАнна;1\n" } }));
  });
});
