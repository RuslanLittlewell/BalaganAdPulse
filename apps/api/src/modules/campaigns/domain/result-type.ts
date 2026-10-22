export const RESULT_TYPES = [
  "MESSAGES",
  "PROFILE_VISITS",
  "LEADS",
  "LINK_CLICKS",
  "LANDING_PAGE_VIEWS",
  "CONVERSIONS",
  "ENGAGEMENT",
  "REACH",
  "VIDEO_VIEWS",
  "APP_INSTALLS",
  "OTHER",
  "UNKNOWN",
] as const;

export type ResultType = (typeof RESULT_TYPES)[number];

const BY_GOAL: Record<string, ResultType> = {
  CONVERSATIONS: "MESSAGES",
  PROFILE_VISIT: "PROFILE_VISITS",
  PROFILE_AND_PAGE_ENGAGEMENT: "PROFILE_VISITS",
  LEAD_GENERATION: "LEADS",
  QUALITY_LEAD: "LEADS",
  LINK_CLICKS: "LINK_CLICKS",
  LANDING_PAGE_VIEWS: "LANDING_PAGE_VIEWS",
  OFFSITE_CONVERSIONS: "CONVERSIONS",
  VALUE: "CONVERSIONS",
  QUALITY_CALL: "CONVERSIONS",
  POST_ENGAGEMENT: "ENGAGEMENT",
  PAGE_LIKES: "ENGAGEMENT",
  EVENT_RESPONSES: "ENGAGEMENT",
  ENGAGED_USERS: "ENGAGEMENT",
  REACH: "REACH",
  IMPRESSIONS: "REACH",
  AD_RECALL_LIFT: "REACH",
  THRUPLAY: "VIDEO_VIEWS",
  TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: "VIDEO_VIEWS",
  APP_INSTALLS: "APP_INSTALLS",
};

export function resultTypeOfGoal(goal: string | null | undefined): ResultType {
  if (goal === null || goal === undefined || goal === "") return "UNKNOWN";
  return BY_GOAL[goal.toUpperCase()] ?? "OTHER";
}

export interface ResultTypeFigure {
  readonly type: ResultType;
  readonly results: number;
  readonly spend: number;
}

export interface TypedDay extends ResultTypeFigure {
  readonly campaignId: string;
  readonly date: Date;
}

export interface CampaignResultKind {
  readonly campaignId: string;
  readonly optimizationGoal: string | null;
}

const ORDER = new Map<ResultType, number>(RESULT_TYPES.map((type, index) => [type, index]));

const byOrder = (a: ResultType, b: ResultType) => ORDER.get(a)! - ORDER.get(b)!;

export function sumByType(figures: readonly ResultTypeFigure[]): ResultTypeFigure[] {
  const totals = new Map<ResultType, { results: number; spend: number }>();
  for (const figure of figures) {
    const running = totals.get(figure.type) ?? { results: 0, spend: 0 };
    totals.set(figure.type, { results: running.results + figure.results, spend: running.spend + figure.spend });
  }
  return [...totals]
    .filter(([, total]) => total.results > 0 || total.spend > 0)
    .map(([type, total]) => ({ type, ...total }))
    .sort((a, b) => b.results - a.results || byOrder(a.type, b.type));
}

export function typesOf(kinds: readonly CampaignResultKind[]): ResultType[] {
  return [...new Set(kinds.map((kind) => resultTypeOfGoal(kind.optimizationGoal)))].sort(byOrder);
}
