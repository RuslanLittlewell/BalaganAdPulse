import { act } from "@testing-library/react";
import { aLead } from "@test/shared/fixtures.js";
import type { Lead, LeadColumn, LeadField } from "@/entities/lead/index.js";
import {
  compareBy,
  DEFAULT_VIEW,
  fieldCatalogue,
  matches,
  operatorsFor,
  pruneState,
  useCrmViews,
  viewKey,
  visibleLeads,
  type Filter,
  type ViewState,
} from "@/features/lead-view-options/index.js";

const FIELDS: LeadField[] = [
  { id: "budget", name: "Бюджет", type: "NUMBER", options: [], position: 0 },
  { id: "meeting", name: "Встреча", type: "DATE", options: [], position: 1 },
  { id: "segment", name: "Сегмент", type: "SELECT", position: 2, options: [{ id: "o1", name: "Опт", color: "blue" }, { id: "o2", name: "Розница", color: "green" }] },
  { id: "channels", name: "Каналы", type: "MULTI_SELECT", position: 3, options: [{ id: "c1", name: "Сайт", color: "teal" }, { id: "c2", name: "Звонок", color: "red" }] },
  { id: "qualified", name: "Квалифицирован", type: "CHECKBOX", options: [], position: 4 },
  { id: "brief", name: "Бриф", type: "LINK", options: [], position: 5 },
];

const COLUMNS: LeadColumn[] = [
  { id: "NEW", kind: "FIXED", name: "Новый", position: 0, color: "blue" },
  { id: "col-1", kind: "CUSTOM", name: "Встреча", position: 0, color: "gray" },
];

let sequence = 0;
const filter = (field: Filter["field"], operator: Filter["operator"], value: Filter["value"] = null): Filter =>
  ({ id: `f${++sequence}`, field, operator, value });

const lead = (fields: Partial<Lead>) => aLead({ id: `lead-${++sequence}`, ...fields });

describe("filter operators", () => {
  const ivan = lead({
    name: "Иван Петров", company: { id: "c1", name: "Ромашка", website: null }, amount: "50000.0000", assigneeId: "m1", tags: ["VIP", "Срочно"],
    createdAt: "2026-03-10T09:00:00.000Z",
    customValues: { budget: "1500.5000", meeting: "2026-11-12", segment: "o1", channels: ["c1"], qualified: true, brief: "https://example.com/brief" },
  });
  const empty = lead({ name: "Без данных", createdAt: "2026-03-12T09:00:00.000Z" });

  it.each([
    ["company contains, any case", filter("company", "contains", "РОМ"), true, false],
    ["company does not contain", filter("company", "notContains", "ром"), false, true],
    ["company is empty", filter("company", "isEmpty"), false, true],
    ["company is not empty", filter("company", "isNotEmpty"), true, false],
    ["amount at least", filter("amount", "gte", "10000"), true, false],
    ["amount at most", filter("amount", "lte", "10000"), false, false],
    ["arrival on a day", filter("arrival", "on", "2026-03-10"), true, false],
    ["arrival before", filter("arrival", "before", "2026-03-11"), true, false],
    ["arrival after", filter("arrival", "after", "2026-03-11"), false, true],
    ["assignee any of", filter("assignee", "anyOf", ["m1", "m2"]), true, false],
    ["assignee none of", filter("assignee", "noneOf", ["m1"]), false, true],
    ["assignee is empty", filter("assignee", "isEmpty"), false, true],
    ["tags contain any of", filter("tags", "anyOf", ["vip", "VIP"]), true, false],
    ["tags contain none of", filter("tags", "noneOf", ["VIP"]), false, true],
    ["stage any of", filter("stage", "anyOf", ["NEW"]), true, true],
    ["custom number at least", filter("custom:budget", "gte", "1500.5"), true, false],
    ["custom day after", filter("custom:meeting", "after", "2026-11-01"), true, false],
    ["custom day is empty", filter("custom:meeting", "isEmpty"), false, true],
    ["custom list any of", filter("custom:segment", "anyOf", ["o1"]), true, false],
    ["custom list none of", filter("custom:segment", "noneOf", ["o1"]), false, true],
    ["custom multiple any of", filter("custom:channels", "anyOf", ["c1", "c2"]), true, false],
    ["custom checkbox checked", filter("custom:qualified", "checked"), true, false],
    ["custom checkbox unchecked", filter("custom:qualified", "unchecked"), false, true],
    ["custom link contains", filter("custom:brief", "contains", "brief"), true, false],
  ])("%s", (_, condition, full, bare) => {
    expect(matches(ivan, condition, FIELDS)).toBe(full);
    expect(matches(empty, condition, FIELDS)).toBe(bare);
  });

  it("ignores a condition still missing its value", () => {
    expect(matches(empty, filter("company", "contains", " "), FIELDS)).toBe(true);
    expect(matches(empty, filter("assignee", "anyOf", []), FIELDS)).toBe(true);
  });

  it("offers operators by field type", () => {
    const kinds = Object.fromEntries(fieldCatalogue(FIELDS).map((field) => [field.ref, operatorsFor(field.kind)]));
    expect(kinds.company).toEqual(["contains", "notContains", "isEmpty", "isNotEmpty"]);
    expect(kinds.amount).toEqual(["gte", "lte", "isEmpty", "isNotEmpty"]);
    expect(kinds.arrival).toEqual(["on", "before", "after"]);
    expect(kinds["custom:meeting"]).toEqual(["on", "before", "after", "isEmpty", "isNotEmpty"]);
    expect(kinds.stage).toEqual(["anyOf", "noneOf"]);
    expect(kinds.assignee).toEqual(["anyOf", "noneOf", "isEmpty", "isNotEmpty"]);
    expect(kinds["custom:qualified"]).toEqual(["checked", "unchecked"]);
  });
});

describe("search and combined conditions", () => {
  const leads = [
    lead({ name: "Анна", company: { id: "c1", name: "Ромашка", website: null }, amount: "20000.0000", assigneeId: "m1" }),
    lead({ name: "Борис", person: { id: "p1", name: "Борис", phone: "+375291234567", email: null, telegram: null, messenger: null }, amount: "5000.0000", assigneeId: "m1" }),
    lead({ name: "Вера", tags: ["Ромашковый"], amount: "30000.0000", assigneeId: "m2" }),
    lead({ name: "Глеб", person: { id: "p2", name: "Глеб", phone: null, email: null, telegram: "@romashka_bot", messenger: null } }),
  ];

  it("searches name, company, contacts and tags without regard to case", () => {
    expect(visibleLeads(leads, { search: "РОМАШ", filters: [] }, FIELDS).map((item) => item.name)).toEqual(["Анна", "Вера"]);
    expect(visibleLeads(leads, { search: "ROMASHKA", filters: [] }, FIELDS).map((item) => item.name)).toEqual(["Глеб"]);
    expect(visibleLeads(leads, { search: "1234", filters: [] }, FIELDS).map((item) => item.name)).toEqual(["Борис"]);
  });

  it("applies every condition together", () => {
    const shown = visibleLeads(leads, { search: "", filters: [filter("amount", "gte", "10000"), filter("assignee", "anyOf", ["m1"])] }, FIELDS);
    expect(shown.map((item) => item.name)).toEqual(["Анна"]);
  });
});

describe("sorting", () => {
  const leads = [
    lead({ name: "Б", amount: null, customValues: { segment: "o2" } }),
    lead({ name: "А", amount: "300.0000", customValues: { segment: "o1" } }),
    lead({ name: "В", amount: "1000.0000" }),
  ];
  const order = (sort: Parameters<typeof compareBy>[0]) => [...leads].sort(compareBy(sort, FIELDS)!).map((item) => item.name);

  it("puts leads without a value last in either direction", () => {
    expect(order({ field: "amount", direction: "asc" })).toEqual(["А", "В", "Б"]);
    expect(order({ field: "amount", direction: "desc" })).toEqual(["В", "А", "Б"]);
  });

  it("sorts a list field by the order of its options", () => {
    expect(order({ field: "custom:segment", direction: "asc" })).toEqual(["А", "Б", "В"]);
  });

  it("sorts names alphabetically", () => {
    expect(order({ field: "name", direction: "asc" })).toEqual(["А", "Б", "В"]);
  });

  it("refuses fields that cannot be sorted", () => {
    expect(compareBy({ field: "tags", direction: "asc" }, FIELDS)).toBeNull();
    expect(compareBy({ field: "custom:channels", direction: "asc" }, FIELDS)).toBeNull();
  });
});

describe("pruning a remembered view", () => {
  const view: ViewState = {
    ...DEFAULT_VIEW,
    filters: [
      filter("custom:gone", "isEmpty"),
      filter("custom:segment", "anyOf", ["o1", "o9"]),
      filter("custom:segment", "anyOf", ["o9"]),
      filter("stage", "anyOf", ["NEW", "col-gone"]),
      filter("company", "contains", "Ром"),
    ],
    sort: { field: "custom:gone", direction: "asc" },
    cardFields: ["amount", "custom:gone", "custom:budget"],
  };

  it("drops deleted fields, options and columns", () => {
    const pruned = pruneState(view, FIELDS, COLUMNS);

    expect(pruned.filters.map((item) => [item.field, item.value])).toEqual([
      ["custom:segment", ["o1"]],
      ["stage", ["NEW"]],
      ["company", "Ром"],
    ]);
    expect(pruned.sort).toBeNull();
    expect(pruned.cardFields).toEqual(["amount", "custom:budget"]);
  });

  it("returns the same view when nothing is stale", () => {
    const fresh: ViewState = { ...DEFAULT_VIEW, filters: [filter("company", "contains", "Ром")] };
    expect(pruneState(fresh, FIELDS, COLUMNS)).toBe(fresh);
  });
});

describe("remembering the view", () => {
  beforeEach(() => { useCrmViews.setState({ views: {} }); });

  it("keeps separate settings per person and board", () => {
    act(() => {
      useCrmViews.getState().update(viewKey("u1", "board-a"), { search: "Ром" });
      useCrmViews.getState().update(viewKey("u1", "board-b"), { compact: true });
      useCrmViews.getState().update(viewKey("u2", "board-a"), { hideEmpty: true });
    });

    const views = useCrmViews.getState().views;
    expect(views[viewKey("u1", "board-a")]).toMatchObject({ search: "Ром", compact: false, hideEmpty: false });
    expect(views[viewKey("u1", "board-b")]).toMatchObject({ search: "", compact: true });
    expect(views[viewKey("u2", "board-a")]).toMatchObject({ search: "", hideEmpty: true });
  });

  it("forgets a board's settings on reset", () => {
    act(() => {
      useCrmViews.getState().update(viewKey("u1", "board-a"), { search: "Ром" });
      useCrmViews.getState().reset(viewKey("u1", "board-a"));
    });

    expect(useCrmViews.getState().views).toEqual({});
  });
});
