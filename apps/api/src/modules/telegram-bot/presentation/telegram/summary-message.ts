import type { ResultTypeFigure, TypedPerformance } from "#modules/campaigns/index.js";
import { isLowerBetter, MANUAL_KPI, type KpiMetric } from "#modules/kpi/index.js";
import type { BotButton, BotReply } from "#modules/telegram-bot/application/bot-api.js";
import type {
  DashboardSummary,
  KpiLine,
  ProjectPage,
  ProjectSummary,
} from "#modules/telegram-bot/application/summary-use-cases.js";
import {
  DEFAULT_PERIOD,
  SUMMARY_PERIODS,
  isSummaryPeriod,
  type DayRange,
  type SummaryPeriod,
} from "#modules/telegram-bot/domain/summary.js";
import { BOT_COPY } from "./bot-copy.js";
import { escapeHtml } from "./html.js";

const COPY = BOT_COPY.summary;
const PREFIX = "s:";
const PROJECT_ID = /^[\w-]{1,64}$/;
const PAGE = /^\d{1,4}$/;
const BUTTON_TEXT = 60;

export type SummaryRequest =
  | { readonly kind: "ask" }
  | { readonly kind: "dashboard"; readonly period: SummaryPeriod }
  | { readonly kind: "list"; readonly page: number }
  | { readonly kind: "project"; readonly projectId: string; readonly period: SummaryPeriod; readonly page: number };

export const isSummaryData = (data: string) => data.startsWith(PREFIX);

export function summaryData(request: SummaryRequest): string {
  switch (request.kind) {
    case "ask": return `${PREFIX}ask`;
    case "dashboard": return `${PREFIX}d:${request.period}`;
    case "list": return `${PREFIX}l:${request.page}`;
    case "project": return `${PREFIX}p:${request.projectId}:${request.period}:${request.page}`;
  }
}

export function summaryRequest(data: string): SummaryRequest | null {
  if (!isSummaryData(data)) return null;
  const [kind, ...rest] = data.slice(PREFIX.length).split(":");
  if (kind === "ask" && rest.length === 0) return { kind: "ask" };
  if (kind === "d" && rest.length === 1 && isSummaryPeriod(rest[0]!)) return { kind: "dashboard", period: rest[0] };
  if (kind === "l" && rest.length === 1 && PAGE.test(rest[0]!)) return { kind: "list", page: Number(rest[0]) };
  if (kind === "p" && rest.length === 3) {
    const [projectId, period, page] = rest as [string, string, string];
    if (PROJECT_ID.test(projectId) && isSummaryPeriod(period) && PAGE.test(page)) {
      return { kind: "project", projectId, period, page: Number(page) };
    }
  }
  return null;
}

const COUNT = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DAY = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const DASH = "—";

export function money(value: number | null, currency: string | null): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  const digits = Math.abs(value) >= 100 ? 0 : 2;
  const plain = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (!currency) return new Intl.NumberFormat("ru-RU", plain).format(value);
  try {
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency, ...plain }).format(value);
  } catch {
    return `${new Intl.NumberFormat("ru-RU", plain).format(value)} ${currency}`;
  }
}

const count = (value: number | null) => (value === null || !Number.isFinite(value) ? DASH : COUNT.format(value));
const decimal = (value: number | null) => (value === null || !Number.isFinite(value) ? DASH : DECIMAL.format(value));
const percent = (value: number | null) => (value === null || !Number.isFinite(value) ? DASH : `${DECIMAL.format(value)} %`);
const wholePercent = (value: number) => `${COUNT.format(value)} %`;

export function rangeText(range: DayRange): string {
  const from = DAY.format(new Date(`${range.from}T00:00:00Z`));
  if (range.from === range.to) return from;
  return `${from} – ${DAY.format(new Date(`${range.to}T00:00:00Z`))}`;
}

const periodLine = (period: SummaryPeriod, range: DayRange) => `<i>${COPY.periods[period]}: ${rangeText(range)}</i>`;

const button = (text: string, request: SummaryRequest): BotButton => ({ text, data: summaryData(request) });

const fitted = (text: string) => (text.length > BUTTON_TEXT ? `${text.slice(0, BUTTON_TEXT - 1)}…` : text);

function periodRows(shown: SummaryPeriod, request: (period: SummaryPeriod) => SummaryRequest): BotButton[][] {
  const buttons = SUMMARY_PERIODS.map((period) =>
    button(period === shown ? `${COPY.chosen} ${COPY.periods[period]}` : COPY.periods[period], request(period)));
  return [buttons.slice(0, 2), buttons.slice(2)];
}

const link = (appUrl: string | null, path: string, text: string) =>
  (appUrl ? [`<a href="${escapeHtml(`${appUrl}${path}`)}">${text}</a>`] : []);

function figureLines(performance: TypedPerformance, currency: string | null): string[] {
  const f = COPY.figures;
  return [
    `${f.spend}: <b>${money(performance.spend, currency)}</b>`,
    `${f.impressions}: ${count(performance.impressions)} · ${f.clicks}: ${count(performance.clicks)}`,
    `${f.ctr}: ${percent(performance.ctr)} · ${f.cpc}: ${money(performance.cpc, currency)}`,
  ];
}

export function summaryQuestion(): BotReply {
  return {
    html: COPY.question,
    buttons: [[
      button(COPY.dashboard, { kind: "dashboard", period: DEFAULT_PERIOD }),
      button(COPY.project, { kind: "list", page: 0 }),
    ]],
  };
}

export function dashboardReply(summary: DashboardSummary, appUrl: string | null): BotReply {
  const f = COPY.figures;
  const several = summary.currencies.length > 1;
  const blocks = summary.currencies.map(({ currency, performance }) => [
    ...(several ? [`<b>${escapeHtml(currency ?? DASH)}</b>`] : []),
    ...figureLines({ ...performance, resultTypes: [] }, currency),
    `${f.conversions}: ${count(performance.conversions)} · ${f.results}: ${count(performance.results)}`,
  ].join("\n"));
  const { standings } = summary;
  const lagging = summary.lagging.map((project) =>
    `${COPY.marks[project.standing]} ${escapeHtml(project.name)} — ${wholePercent(project.percent)}`);
  return {
    html: [
      `<b>${COPY.dashboardTitle}</b>`,
      periodLine(summary.period, summary.range),
      "",
      ...(blocks.length > 0 ? [blocks.join("\n\n")] : [COPY.noFigures]),
      "",
      `<b>${COPY.kpiMonth}</b> <i>(${rangeText(summary.month)})</i>`,
      ...(["met", "behind", "danger", "none"] as const).map((standing) =>
        `${COPY.marks[standing]} ${COPY.standings[standing]}: ${standings[standing]}`),
      ...(lagging.length > 0 ? ["", ...lagging] : []),
      ...(summary.moreLagging > 0 ? [`${COPY.more} ${summary.moreLagging}`] : []),
      ...(appUrl ? ["", ...link(appUrl, "/", COPY.openDashboard)] : []),
    ].join("\n"),
    buttons: [
      ...periodRows(summary.period, (period) => ({ kind: "dashboard", period })),
      [button(COPY.back, { kind: "ask" })],
    ],
  };
}

export function projectListReply(list: ProjectPage): BotReply {
  if (list.projects.length === 0) {
    return { html: COPY.noProjects, buttons: [[button(COPY.back, { kind: "ask" })]] };
  }
  const paging = [
    ...(list.page > 0 ? [button(COPY.previous, { kind: "list", page: list.page - 1 })] : []),
    ...(list.page < list.pages - 1 ? [button(COPY.next, { kind: "list", page: list.page + 1 })] : []),
  ];
  const title = list.pages > 1
    ? `${COPY.chooseProject} · ${COPY.page} ${list.page + 1} ${COPY.of} ${list.pages}`
    : COPY.chooseProject;
  return {
    html: `<b>${title}</b>`,
    buttons: [
      ...list.projects.map((project) => [button(
        fitted(project.clientName ? `${project.name} · ${project.clientName}` : project.name),
        { kind: "project", projectId: project.id, period: DEFAULT_PERIOD, page: list.page },
      )]),
      ...(paging.length > 0 ? [paging] : []),
      [button(COPY.back, { kind: "ask" })],
    ],
  };
}

export function projectGoneReply(page: number): BotReply {
  return { html: COPY.projectGone, buttons: [[button(COPY.toProjects, { kind: "list", page })]] };
}

const MONEY_METRICS: ReadonlySet<KpiMetric> = new Set(["SPEND", "REVENUE", "CPC", "CPM", "CPA", "COST_PER_RESULT"]);
const SHARE_METRICS: ReadonlySet<KpiMetric> = new Set(["CTR"]);
const RATIO_METRICS: ReadonlySet<KpiMetric> = new Set(["ROAS", "FREQUENCY"]);

function kpiValue(metric: KpiMetric | typeof MANUAL_KPI, value: number | null, currency: string | null): string {
  if (metric === MANUAL_KPI) return value === null ? DASH : decimalOrCount(value);
  if (MONEY_METRICS.has(metric)) return money(value, currency);
  if (SHARE_METRICS.has(metric)) return percent(value);
  if (RATIO_METRICS.has(metric)) return decimal(value);
  return count(value);
}

const decimalOrCount = (value: number) => (Number.isInteger(value) ? COUNT.format(value) : DECIMAL.format(value));

function typeName(type: ResultTypeFigure["type"]): string {
  const name = COPY.resultTypes[type];
  return name === COPY.figures.conversions ? `${COPY.resultsOf} ${name}` : name;
}

function kpiName(line: KpiLine): string {
  const { kpi } = line;
  const name = kpi.metric === MANUAL_KPI
    ? kpi.name
    : kpi.resultType
      ? (kpi.metric === "RESULTS" ? typeName(kpi.resultType) : `${COPY.figures.cost} · ${COPY.resultTypes[kpi.resultType]}`)
      : COPY.metrics[kpi.metric];
  const account = line.account ? ` (${COPY.channels[line.account.channel]} · ${line.account.accountId})` : "";
  return escapeHtml(`${name}${account}`);
}

function kpiText(line: KpiLine, currency: string | null): string {
  const { metric } = line.kpi;
  const actual = kpiValue(metric, line.reading.actual, currency);
  const target = kpiValue(metric, line.reading.target, currency);
  const share = line.reading.percent === null || !Number.isFinite(line.reading.percent)
    ? ""
    : ` · ${wholePercent(Math.round(line.reading.percent))}`;
  const against = metric !== MANUAL_KPI && isLowerBetter(metric)
    ? `${actual}, ${COPY.goal} ${target}`
    : `${actual} ${COPY.of} ${target}`;
  return `${COPY.marks[line.standing]} ${kpiName(line)}: ${against}${share}`;
}

function resultLines(performance: TypedPerformance, currency: string | null): string[] {
  const f = COPY.figures;
  const types = performance.resultTypes.filter((figure) => figure.results > 0);
  if (types.length === 1) {
    const [only] = types as [ResultTypeFigure];
    return [`${typeName(only.type)}: <b>${count(only.results)}</b> · ${f.cost}: ${money(only.spend / only.results, currency)}`];
  }
  if (types.length > 1) return types.map((figure) => `${typeName(figure.type)}: <b>${count(figure.results)}</b>`);
  if (performance.results > 0) {
    return [`${f.results}: <b>${count(performance.results)}</b> · ${f.costPerResult}: ${money(performance.costPerResult, currency)}`];
  }
  return [];
}

export function projectReply(summary: ProjectSummary, appUrl: string | null): BotReply {
  const { project, performance } = summary;
  const currency = project.currency;
  const f = COPY.figures;
  const title = project.clientName
    ? `<b>📁 ${escapeHtml(project.name)}</b> · ${escapeHtml(project.clientName)}`
    : `<b>📁 ${escapeHtml(project.name)}</b>`;
  return {
    html: [
      title,
      periodLine(summary.period, summary.range),
      "",
      ...figureLines(performance, currency),
      `${f.conversions}: ${count(performance.conversions)}`,
      ...(performance.revenue > 0
        ? [`${f.revenue}: ${money(performance.revenue, currency)} · ${f.roas}: ${decimal(performance.roas)}`]
        : []),
      ...resultLines(performance, currency),
      "",
      `<b>${COPY.kpi}</b>`,
      ...(summary.kpis.length > 0 ? summary.kpis.map((line) => kpiText(line, currency)) : [COPY.noKpi]),
      ...(appUrl ? ["", ...link(appUrl, `/projects/${encodeURIComponent(project.id)}`, COPY.openProject)] : []),
    ].join("\n"),
    buttons: [
      ...periodRows(summary.period, (period) => ({ kind: "project", projectId: project.id, period, page: summary.page })),
      [button(COPY.toProjects, { kind: "list", page: summary.page })],
    ],
  };
}
