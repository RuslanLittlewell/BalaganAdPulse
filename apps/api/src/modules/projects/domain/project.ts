export const PROJECT_PRIORITIES = ["CRITICAL", "URGENT", "WAITING", "IDLE", "NEW"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const CURRENCIES = ["BYN", "RUB", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "BYN";

export interface ProjectRecord {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly niche: string | null;
  readonly monthlyBudget: string | null;
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
