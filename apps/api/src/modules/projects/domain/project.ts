/** How much attention a project needs. Named by what it means rather than by
 * the colour it is drawn in — the palette belongs to the interface. */
export const PROJECT_PRIORITIES = ["CRITICAL", "URGENT", "WAITING", "IDLE", "NEW"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

/**
 * What a monthly budget is stated in.
 *
 * Never inferred from the client or the locale: it is what the agency and the
 * client agreed, and only they know it.
 */
export const CURRENCIES = ["BYN", "RUB", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** What a new project's budget is stated in until somebody says otherwise. */
export const DEFAULT_CURRENCY: Currency = "BYN";

/** The unit of work: what the agency runs for a client. Niche, budget and the
 * logo describe the work, not the company behind it — one client can run
 * several projects that share nothing but the contact details. */
export interface ProjectRecord {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly niche: string | null;
  /** A decimal carried as a string across the boundary; never a float. */
  readonly monthlyBudget: string | null;
  /** Present even when the amount is not, so entering one later is a one-field
   * decision rather than two. */
  readonly budgetCurrency: Currency;
  readonly priority: ProjectPriority;
  readonly image: string | null;
  readonly avatarPath: string | null;
  readonly position: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ProjectChange {
  readonly clientId?: string;
  readonly name?: string;
  readonly niche?: string | null;
  readonly monthlyBudget?: number | null;
  readonly budgetCurrency?: Currency;
  readonly priority?: ProjectPriority;
}

export interface NewProject extends ProjectChange {
  readonly clientId: string;
  readonly name: string;
}
