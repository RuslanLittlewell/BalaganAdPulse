export const RESULT_TYPES = [
  "MESSAGES",
  "PROFILE_VISITS",
  "LEADS",
  "QUALIFIED_LEADS",
  "CALLS",
  "CONTACTS",
  "APPOINTMENTS",
  "DIRECTIONS",
  "PURCHASES",
  "CHECKOUTS",
  "SIGNUPS",
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

const BY_CATEGORY: Record<string, ResultType> = {
  SUBMIT_LEAD_FORM: "LEADS",
  IMPORTED_LEAD: "LEADS",
  REQUEST_QUOTE: "LEADS",
  QUALIFIED_LEAD: "QUALIFIED_LEADS",
  CONVERTED_LEAD: "QUALIFIED_LEADS",
  PHONE_CALL_LEAD: "CALLS",
  CONTACT: "CONTACTS",
  BOOK_APPOINTMENT: "APPOINTMENTS",
  GET_DIRECTIONS: "DIRECTIONS",
  PURCHASE: "PURCHASES",
  STORE_SALE: "PURCHASES",
  SUBSCRIBE_PAID: "PURCHASES",
  ADD_TO_CART: "CHECKOUTS",
  BEGIN_CHECKOUT: "CHECKOUTS",
  SIGNUP: "SIGNUPS",
  PAGE_VIEW: "LANDING_PAGE_VIEWS",
  OUTBOUND_CLICK: "LINK_CLICKS",
  ENGAGEMENT: "ENGAGEMENT",
  DOWNLOAD: "APP_INSTALLS",
};

export function resultTypeOfCategory(category: string): ResultType {
  return BY_CATEGORY[category.toUpperCase()] ?? "OTHER";
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

export interface CampaignCategories {
  readonly campaignId: string;
  readonly categories: readonly string[];
}

export interface CategoryResult {
  readonly date: Date;
  readonly category: string;
  readonly results: number;
}

export interface SpentDay {
  readonly date: Date;
  readonly spend: number;
}

export type DatedFigure = ResultTypeFigure & { readonly date: Date };

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

export function typesOfCategories(categories: readonly string[]): ResultType[] {
  return [...new Set(categories.map(resultTypeOfCategory))].sort(byOrder);
}

export function typedByCategory(
  days: readonly SpentDay[],
  results: readonly CategoryResult[],
  types: readonly ResultType[],
): DatedFigure[] {
  const spends = new Map(days.map((day) => [day.date.getTime(), day.spend]));
  const counted = new Map<string, number>();
  for (const result of results) {
    const key = `${result.date.getTime()}|${resultTypeOfCategory(result.category)}`;
    counted.set(key, (counted.get(key) ?? 0) + result.results);
  }
  const every = [...new Set([...types, ...results.map((result) => resultTypeOfCategory(result.category))])];
  const times = [...new Set([...spends.keys(), ...results.map((result) => result.date.getTime())])];
  return times.flatMap((time) => every.map((type) => ({
    date: new Date(time), type, results: counted.get(`${time}|${type}`) ?? 0, spend: spends.get(time) ?? 0,
  })));
}
