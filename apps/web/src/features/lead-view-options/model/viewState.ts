import { create } from "zustand";
import { persist } from "zustand/middleware";

export const BUILT_IN_FIELDS = [
  "name", "stage", "amount", "assignee", "person", "company", "tags", "service", "phone",
  "telegram", "messenger", "email", "website", "source", "arrival",
] as const;

export type BuiltInField = (typeof BUILT_IN_FIELDS)[number];

export type CustomFieldRef = `custom:${string}`;

export type FieldRef = BuiltInField | CustomFieldRef | 'peopleCount' | 'leadCount' | 'createdAt';

export type Operator =
  | "contains" | "notContains" | "isEmpty" | "isNotEmpty"
  | "gte" | "lte" | "on" | "before" | "after" | "between"
  | "anyOf" | "noneOf" | "checked" | "unchecked";

export type FilterValue = string | string[] | null;

export interface Filter {
  id: string;
  field: FieldRef;
  operator: Operator;
  value: FilterValue;
}

export type SortDirection = "asc" | "desc";

export interface Sort {
  field: FieldRef;
  direction: SortDirection;
}

export interface ViewState {
  search: string;
  filters: Filter[];
  sort: Sort | null;
  cardFields: FieldRef[];
  hideEmpty: boolean;
  compact: boolean;
}

export const DEFAULT_CARD_FIELDS: readonly FieldRef[] = ["amount", "assignee", "company", "phone", "arrival", "tags"];

export const DEFAULT_VIEW: ViewState = {
  search: "",
  filters: [],
  sort: null,
  cardFields: [...DEFAULT_CARD_FIELDS],
  hideEmpty: false,
  compact: false,
};

export function customRef(fieldId: string): CustomFieldRef {
  return `custom:${fieldId}`;
}

export function customIdOf(ref: FieldRef): string | null {
  return ref.startsWith("custom:") ? ref.slice("custom:".length) : null;
}

export const viewKey = (userId: string, boardKey: string) => `${userId}:${boardKey}`;
export const recordViewKey = (userId: string, kind: 'companies' | 'people', clientId: string) => `${userId}:${kind}:${clientId}`;

export const COMPANY_VIEW: ViewState = { ...DEFAULT_VIEW, cardFields: ['name', 'website', 'phone', 'peopleCount', 'leadCount', 'createdAt'] };
export const PERSON_VIEW: ViewState = { ...DEFAULT_VIEW, cardFields: ['name', 'company', 'phone', 'email', 'telegram', 'messenger', 'leadCount', 'createdAt'] };

interface CrmViewsState {
  views: Record<string, ViewState>;
  update: (key: string, change: Partial<ViewState>) => void;
  reset: (key: string) => void;
}

export const useCrmViews = create<CrmViewsState>()(
  persist(
    (set) => ({
      views: {},
      update: (key, change) =>
        set((state) => ({ views: { ...state.views, [key]: { ...DEFAULT_VIEW, ...state.views[key], ...change } } })),
      reset: (key) =>
        set((state) => {
          if (!(key in state.views)) return state;
          const { [key]: _forgotten, ...rest } = state.views;
          return { views: rest };
        }),
    }),
    { name: "adpulse-crm-views", version: 1, partialize: (state) => ({ views: state.views }) },
  ),
);

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function currentMonthPeriod(now: Date = new Date()): Filter {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { id: "filter-period-month", field: "arrival", operator: "between", value: [isoDay(first), isoDay(last)] };
}

export function useViewState(userId: string | undefined, boardKey: string | undefined) {
  const key = userId && boardKey ? viewKey(userId, boardKey) : null;
  const stored = useCrmViews((state) => (key ? state.views[key] : undefined));
  const update = useCrmViews((state) => state.update);
  const view: ViewState = stored ? { ...DEFAULT_VIEW, ...stored } : { ...DEFAULT_VIEW, filters: [currentMonthPeriod()] };
  return {
    view,
    change: (change: Partial<ViewState>) => { if (key) update(key, { ...view, ...change }); },
  };
}

export function useRecordViewState(userId: string | undefined, kind: 'companies' | 'people', clientId: string | undefined) {
  const key = userId && clientId ? recordViewKey(userId, kind, clientId) : null;
  const stored = useCrmViews((state) => key ? state.views[key] : undefined);
  const update = useCrmViews((state) => state.update);
  const defaults = kind === 'companies' ? COMPANY_VIEW : PERSON_VIEW;
  const view: ViewState = stored ? { ...defaults, ...stored } : defaults;
  return { view, change: (change: Partial<ViewState>) => { if (key) update(key, { ...view, ...change }); } };
}
