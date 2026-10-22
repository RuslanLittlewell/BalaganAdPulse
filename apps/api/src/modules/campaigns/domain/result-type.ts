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

export interface ResultsOfType {
  readonly type: ResultType;
  readonly results: number;
}

export interface AdSetResults {
  readonly adSetId: string;
  readonly campaignId: string;
  readonly optimizationGoal: string | null;
  readonly results: number;
}

export function resultsByType(adSets: readonly AdSetResults[]): ResultsOfType[] {
  const totals = new Map<ResultType, number>();
  for (const adSet of adSets) {
    const type = resultTypeOfGoal(adSet.optimizationGoal);
    totals.set(type, (totals.get(type) ?? 0) + adSet.results);
  }
  return [...totals].map(([type, results]) => ({ type, results })).sort((a, b) => b.results - a.results);
}
