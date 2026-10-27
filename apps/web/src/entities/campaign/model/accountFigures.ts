import type { AdAccount, MeasuredFigures, ProjectFigures } from "../api/api.js";
import { EMPTY_PERFORMANCE } from "./display.js";

const NOTHING: MeasuredFigures = { performance: EMPTY_PERFORMANCE, days: [] };

export function figuresOfAccount(figures: ProjectFigures | undefined, account: AdAccount | null | undefined): MeasuredFigures {
  if (!figures) return NOTHING;
  if (!account) return figures;
  return figures.accounts.find((entry) => entry.channel === account.channel && entry.accountId === account.accountId) ?? NOTHING;
}
