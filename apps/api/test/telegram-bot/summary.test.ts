import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import {
  performanceOf,
  type CurrencyPerformance,
  type ProjectFigures,
  type ProjectKpi,
  type ResultTypeFigure,
  type TypedPerformance,
} from "../../src/modules/campaigns/index.js";
import {
  BOT_COPY,
  createSummaryUseCases,
  dashboardReply,
  money,
  projectListReply,
  projectReply,
  summaryData,
  summaryRequest,
  type DashboardSummary,
  type ProjectSummary,
  type SummaryProject,
} from "../../src/modules/telegram-bot/index.js";

const CHAT = 55;
const COPY = BOT_COPY.summary;
const actor = { membershipId: "m1", role: "MANAGER" } as unknown as ActorContext;

const figures = (measured: Partial<Parameters<typeof performanceOf>[0][number]>, resultTypes: ResultTypeFigure[] = []): TypedPerformance => ({
  ...performanceOf([{ spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, results: 0, revenue: 0, ...measured }]),
  resultTypes,
});

const kpi = (fields: Partial<ProjectKpi> & Pick<ProjectKpi, "metric" | "target">): ProjectKpi =>
  ({ enabled: true, account: null, ...fields });

const entry = (projectId: string, kpis: ProjectKpi[], performance = figures({ spend: 100, clicks: 10 })): ProjectFigures =>
  ({ projectId, kpis, performance, days: [], accounts: [] });

const project = (id: string, name: string, fields: Partial<SummaryProject> = {}): SummaryProject =>
  ({ id, name, clientName: "Acme", currency: "RUB", kpiTracked: true, ...fields });

let role: string;
let reads: {
  projects: ReturnType<typeof vi.fn>;
  projectFigures: ReturnType<typeof vi.fn>;
  agencyFigures: ReturnType<typeof vi.fn>;
};
let now: Date;

const useCases = () => createSummaryUseCases({
  links: { memberOf: async (chatId) => (chatId === CHAT ? "m1" : null) },
  members: {
    describe: async () => ({ role: role as never, active: true, organizationActive: true, tasksOn: true, actor }),
  },
  reads,
  clock: { now: () => now },
  timeZone: "Europe/Minsk",
});

beforeEach(() => {
  role = "MANAGER";
  now = new Date("2026-10-15T09:00:00Z");
  reads = {
    projects: vi.fn(async () => []),
    projectFigures: vi.fn(async () => []),
    agencyFigures: vi.fn(async () => []),
  };
});

describe("who may ask for a summary", () => {
  it("sends a chat that is not linked to its profile and reads nothing", async () => {
    expect(await useCases().dashboard(77, "m")).toEqual({ kind: "unlinked" });
    expect(reads.projects).not.toHaveBeenCalled();
  });

  it("refuses a member to whom the bot is not available", async () => {
    role = "GUEST";

    expect(await useCases().menu(CHAT)).toEqual({ kind: "forbidden" });
    expect(await useCases().project(CHAT, "p1", "m", 0)).toEqual({ kind: "forbidden" });
    expect(reads.projectFigures).not.toHaveBeenCalled();
  });

  it("opens the menu for a member who may use the bot", async () => {
    expect(await useCases().menu(CHAT)).toEqual({ kind: "ready", value: null });
  });
});

describe("the dashboard summary", () => {
  const cpa = (target: string) => kpi({ metric: "CPA", target });
  const atCpa100 = (id: string, target: string) => entry(id, [cpa(target)], figures({ spend: 1000, conversions: 10 }));

  it("counts the month's KPI standing and names the projects behind, worst first", async () => {
    reads.projects.mockResolvedValue([
      project("a", "Альфа"), project("b", "Бета"), project("c", "Вега"),
      project("e", "Евроопт"), project("g", "Гиппо"), project("n", "Новый"),
      project("x", "Без учёта", { kpiTracked: false }),
    ]);
    reads.projectFigures.mockResolvedValue([
      atCpa100("a", "100"), atCpa100("b", "120"), atCpa100("c", "95"),
      atCpa100("e", "54"), atCpa100("g", "78"), atCpa100("x", "10"),
    ]);

    const outcome = await useCases().dashboard(CHAT, "y");
    if (outcome.kind !== "ready") throw new Error(outcome.kind);

    expect(outcome.value.standings).toEqual({ met: 3, behind: 1, danger: 1, none: 1 });
    expect(outcome.value.lagging).toEqual([
      { name: "Евроопт", percent: 54, standing: "danger" },
      { name: "Гиппо", percent: 78, standing: "behind" },
    ]);
    expect(reads.projectFigures).toHaveBeenCalledWith(actor, { from: "2026-10-01", to: "2026-10-15" });
    expect(reads.agencyFigures).toHaveBeenCalledWith(actor, { from: "2026-10-14", to: "2026-10-14" });
    expect(outcome.value.range).toEqual({ from: "2026-10-14", to: "2026-10-14" });
  });

  it("names at most ten projects behind and says how many more there are", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `p${index}`);
    reads.projects.mockResolvedValue(ids.map((id) => project(id, id)));
    reads.projectFigures.mockResolvedValue(ids.map((id) => atCpa100(id, "50")));

    const outcome = await useCases().dashboard(CHAT, "m");
    if (outcome.kind !== "ready") throw new Error(outcome.kind);

    expect(outcome.value.lagging).toHaveLength(10);
    expect(outcome.value.moreLagging).toBe(2);
  });

  it("keeps each currency apart, the largest spend first", async () => {
    const rub: CurrencyPerformance = { currency: "RUB", performance: performanceOf([]) };
    const usd: CurrencyPerformance = { currency: "USD", performance: { ...performanceOf([]), spend: 5000 } };
    reads.agencyFigures.mockResolvedValue([rub, usd]);

    const outcome = await useCases().dashboard(CHAT, "m");
    if (outcome.kind !== "ready") throw new Error(outcome.kind);

    expect(outcome.value.currencies.map((group) => group.currency)).toEqual(["USD", "RUB"]);
  });
});

describe("the project list", () => {
  const twenty = Array.from({ length: 20 }, (_, index) => project(`p${index}`, `Проект ${String(20 - index).padStart(2, "0")}`));

  it("gives eight projects a page, in alphabetical order", async () => {
    reads.projects.mockResolvedValue(twenty);

    const first = await useCases().projects(CHAT, 0);
    const last = await useCases().projects(CHAT, 2);

    if (first.kind !== "ready" || last.kind !== "ready") throw new Error("not ready");
    expect(first.value.pages).toBe(3);
    expect(first.value.projects.map((each) => each.name)).toEqual(
      ["01", "02", "03", "04", "05", "06", "07", "08"].map((number) => `Проект ${number}`),
    );
    expect(last.value.projects.map((each) => each.name)).toEqual(["Проект 17", "Проект 18", "Проект 19", "Проект 20"]);
  });

  it("shows the last page for a page past the end", async () => {
    reads.projects.mockResolvedValue(twenty);

    const outcome = await useCases().projects(CHAT, 99);

    expect(outcome.kind === "ready" && outcome.value.page).toBe(2);
  });
});

describe("a project summary", () => {
  it("gives a project the member no longer reaches no figures", async () => {
    reads.projects.mockResolvedValue([project("p1", "Евроопт")]);

    expect(await useCases().project(CHAT, "p2", "m", 0)).toEqual({ kind: "gone" });
    expect(reads.projectFigures).not.toHaveBeenCalled();
  });

  it("reads each enabled KPI against its target for the period", async () => {
    reads.projects.mockResolvedValue([project("p1", "Евроопт")]);
    reads.projectFigures.mockResolvedValue([entry("p1", [
      kpi({ metric: "RESULTS", target: "300", resultType: "LEADS" }),
      kpi({ metric: "CPA", target: "10", enabled: false }),
    ], figures({ spend: 6000, results: 312 }, [{ type: "LEADS", results: 312, spend: 6000 }]))]);

    const outcome = await useCases().project(CHAT, "p1", "pm", 3);
    if (outcome.kind !== "ready") throw new Error(outcome.kind);

    expect(reads.projectFigures).toHaveBeenCalledWith(actor, { from: "2026-09-01", to: "2026-09-30" });
    expect(outcome.value.page).toBe(3);
    expect(outcome.value.kpis).toHaveLength(1);
    expect(outcome.value.kpis[0]).toMatchObject({
      reading: { actual: 312, target: 300, percent: 104 }, standing: "met",
    });
  });

  it("takes today in the task time zone", async () => {
    now = new Date("2026-10-31T22:30:00Z");
    reads.projects.mockResolvedValue([project("p1", "Евроопт")]);

    await useCases().project(CHAT, "p1", "m", 0);

    expect(reads.projectFigures).toHaveBeenCalledWith(actor, { from: "2026-11-01", to: "2026-11-01" });
  });
});

describe("the buttons' data", () => {
  it.each([
    { kind: "ask" },
    { kind: "dashboard", period: "7d" },
    { kind: "list", page: 2 },
    { kind: "project", projectId: "0b7c2e5e-8a63-4a43-9a43-0d6c3c1c7f0e", period: "pm", page: 1 },
  ] as const)("reads back $kind as it was written, within Telegram's 64 bytes", (request) => {
    const data = summaryData(request);

    expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
    expect(summaryRequest(data)).toEqual(request);
  });

  it.each(["s:d:week", "s:l:-1", "s:p:../etc:m:0", "s:p:p1:m", "s:what", "create:d1"])("ignores %s", (data) => {
    expect(summaryRequest(data)).toBeNull();
  });
});

describe("the summary messages", () => {
  const dashboard = (fields: Partial<DashboardSummary>): DashboardSummary => ({
    period: "m",
    range: { from: "2026-10-01", to: "2026-10-15" },
    currencies: [],
    month: { from: "2026-10-01", to: "2026-10-15" },
    standings: { met: 3, behind: 1, danger: 1, none: 0 },
    lagging: [],
    moreLagging: 0,
    ...fields,
  });

  it("gives each currency its own block, never summed", () => {
    const reply = dashboardReply(dashboard({
      currencies: [
        { currency: "USD", performance: { ...performanceOf([]), spend: 5000 } },
        { currency: "RUB", performance: { ...performanceOf([]), spend: 245300 } },
      ],
    }), null);

    expect(reply.html).toContain(`<b>USD</b>\n${COPY.figures.spend}: <b>${money(5000, "USD")}</b>`);
    expect(reply.html).toContain(`<b>RUB</b>\n${COPY.figures.spend}: <b>${money(245300, "RUB")}</b>`);
  });

  it("lists the standing, the projects behind and how many more, with a link to the dashboard", () => {
    const reply = dashboardReply(dashboard({
      lagging: [{ name: "Евро<опт>", percent: 54, standing: "danger" }, { name: "Гиппо", percent: 78, standing: "behind" }],
      moreLagging: 2,
    }), "https://adpulse.example");

    expect(reply.html).toContain(`${COPY.marks.met} ${COPY.standings.met}: 3`);
    expect(reply.html).toContain(`${COPY.marks.danger} Евро&lt;опт&gt; — 54 %`);
    expect(reply.html.indexOf("Евро&lt;опт&gt;")).toBeLessThan(reply.html.indexOf("Гиппо"));
    expect(reply.html).toContain(`${COPY.more} 2`);
    expect(reply.html).toContain(`<a href="https://adpulse.example/">${COPY.openDashboard}</a>`);
  });

  it("offers the four periods, marks the one shown, and leads back to the question", () => {
    const reply = dashboardReply(dashboard({ period: "7d" }), null);

    expect(reply.buttons).toEqual([
      [{ text: "Вчера", data: "s:d:y" }, { text: "✓ 7 дней", data: "s:d:7d" }],
      [{ text: "Этот месяц", data: "s:d:m" }, { text: "Прошлый месяц", data: "s:d:pm" }],
      [{ text: "← Назад", data: "s:ask" }],
    ]);
  });

  it("says when the period has no figures", () => {
    expect(dashboardReply(dashboard({}), null).html).toContain(COPY.noFigures);
  });

  it("puts a project per row with its client, and pages between them", () => {
    const reply = projectListReply({
      page: 1,
      pages: 3,
      projects: [project("p1", "Евроопт"), project("p2", "Гиппо", { clientName: null })],
    });

    expect(reply.html).toBe(`<b>${COPY.chooseProject} · ${COPY.page} 2 ${COPY.of} 3</b>`);
    expect(reply.buttons).toEqual([
      [{ text: "Евроопт · Acme", data: "s:p:p1:m:1" }],
      [{ text: "Гиппо", data: "s:p:p2:m:1" }],
      [{ text: COPY.previous, data: "s:l:0" }, { text: COPY.next, data: "s:l:2" }],
      [{ text: COPY.back, data: "s:ask" }],
    ]);
  });

  it("says there is nothing to list", () => {
    expect(projectListReply({ page: 0, pages: 1, projects: [] }).html).toBe(COPY.noProjects);
  });

  const summary = (fields: Partial<ProjectSummary> = {}): ProjectSummary => ({
    project: project("p1", "Евроопт"),
    period: "m",
    range: { from: "2026-10-01", to: "2026-10-31" },
    page: 2,
    performance: figures({ spend: 6000, impressions: 120000, clicks: 1800, conversions: 40, results: 312 }, [
      { type: "LEADS", results: 312, spend: 6000 },
    ]),
    kpis: [{
      kpi: { metric: "RESULTS", target: "300", resultType: "LEADS" },
      account: null,
      reading: { actual: 312, target: 300, percent: 104 },
      standing: "met",
    }],
    ...fields,
  });

  it("shows a project's figures, its KPIs against their targets and a link to it", () => {
    const reply = projectReply(summary(), "https://adpulse.example");

    expect(reply.html).toContain("<b>📁 Евроопт</b> · Acme");
    expect(reply.html).toContain(`<i>${COPY.periods.m}: 1 октября – 31 октября</i>`);
    expect(reply.html).toContain(`${COPY.figures.spend}: <b>${money(6000, "RUB")}</b>`);
    expect(reply.html).toContain(`${COPY.figures.conversions}: 40`);
    expect(reply.html).toContain(`Результаты - Лиды: <b>312</b> · ${COPY.figures.cost}: ${money(6000 / 312, "RUB")}`);
    expect(reply.html).toContain("✅ Результаты - Лиды: 312 из 300 · 104 %");
    expect(reply.html).toContain(`<a href="https://adpulse.example/projects/p1">${COPY.openProject}</a>`);
    expect(reply.buttons?.at(-1)).toEqual([{ text: COPY.toProjects, data: "s:l:2" }]);
    expect(reply.buttons?.[0]?.[0]).toEqual({ text: "Вчера", data: "s:p:p1:y:2" });
  });

  it("shows a lower-is-better KPI against its goal, and lists several result types without a cost", () => {
    const reply = projectReply(summary({
      performance: figures({ spend: 1000, results: 30 }, [
        { type: "MESSAGES", results: 20, spend: 600 },
        { type: "CALLS", results: 10, spend: 400 },
      ]),
      kpis: [{
        kpi: { metric: "CPA", target: "700" },
        account: { channel: "GOOGLE", accountId: "123" },
        reading: { actual: 786, target: 700, percent: 89.06 },
        standing: "behind",
      }],
    }), null);

    expect(reply.html).toContain(`🟡 CPL (Google Ads · 123): ${money(786, "RUB")}, ${COPY.goal} ${money(700, "RUB")} · 89 %`);
    expect(reply.html).toContain("Сообщения: <b>20</b>\nЗвонки: <b>10</b>");
    expect(reply.html).not.toContain("href");
  });

  it("says when a project has no KPIs", () => {
    expect(projectReply(summary({ kpis: [] }), null).html).toContain(COPY.noKpi);
  });
});
