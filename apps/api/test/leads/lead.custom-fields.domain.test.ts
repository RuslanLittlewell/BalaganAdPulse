import { describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/domain/index.js";
import {
  applyCustomValues,
  assertFieldName,
  BUILT_IN_FIELD_NAMES,
  normalizeValue,
  OPTION_LIMIT,
  settleOptions,
  withoutOptions,
  type FieldOption,
  type LeadFieldType,
} from "../../src/modules/leads/domain/lead-field.js";

const OPTIONS: FieldOption[] = [
  { id: "o1", name: "Опт", color: "blue" },
  { id: "o2", name: "Розница", color: "green" },
  { id: "o3", name: "VIP", color: "red" },
];

const field = (type: LeadFieldType, id = "f1") => ({ id, name: "Поле", type, options: type === "SELECT" || type === "MULTI_SELECT" ? OPTIONS : [] });

const refused = (work: () => unknown) => {
  try {
    work();
  } catch (error) {
    return error instanceof AppError && error.category === "validation";
  }
  return false;
};

describe("values of each field type", () => {
  it.each([
    ["TEXT", "  Привет  ", "Привет"],
    ["NUMBER", "-1500.5", "-1500.5000"],
    ["NUMBER", "007", "7.0000"],
    ["NUMBER", "-0", "0.0000"],
    ["NUMBER", "12345678901234.1234", "12345678901234.1234"],
    ["DATE", "2024-02-29", "2024-02-29"],
    ["LINK", "https://example.com/a?b=1", "https://example.com/a?b=1"],
    ["CHECKBOX", true, true],
    ["SELECT", "o2", "o2"],
    ["MULTI_SELECT", ["o3", "o1"], ["o1", "o3"]],
  ] as const)("stores a %s value", (type, raw, stored) => {
    expect(normalizeValue(field(type), raw)).toEqual(stored);
  });

  it.each([
    ["TEXT", ""],
    ["TEXT", "   "],
    ["NUMBER", ""],
    ["DATE", ""],
    ["LINK", ""],
    ["CHECKBOX", false],
    ["SELECT", ""],
    ["MULTI_SELECT", []],
    ["TEXT", null],
  ] as const)("treats an empty %s value as no value", (type, raw) => {
    expect(normalizeValue(field(type), raw)).toBeNull();
  });

  it.each([
    ["TEXT", "x".repeat(2001)],
    ["TEXT", 5],
    ["NUMBER", "много"],
    ["NUMBER", "1.23456"],
    ["NUMBER", "123456789012345"],
    ["NUMBER", 15],
    ["NUMBER", "1,5"],
    ["DATE", "2026-02-30"],
    ["DATE", "12.11.2026"],
    ["LINK", "ftp://example.com"],
    ["LINK", "javascript:alert(1)"],
    ["LINK", `https://example.com/${"x".repeat(2048)}`],
    ["CHECKBOX", "true"],
    ["SELECT", "o9"],
    ["MULTI_SELECT", ["o1", "o1"]],
    ["MULTI_SELECT", ["o9"]],
    ["MULTI_SELECT", "o1"],
  ] as const)("refuses the %s value %j", (type, raw) => {
    expect(refused(() => normalizeValue(field(type), raw))).toBe(true);
  });
});

describe("applying values to a lead", () => {
  const fields = [field("NUMBER", "budget"), field("SELECT", "segment")];

  it("changes only the named fields", () => {
    expect(applyCustomValues(fields, { budget: "1000.0000", segment: "o1" }, { budget: "2000" }))
      .toEqual({ budget: "2000.0000", segment: "o1" });
  });

  it("clears a field set to null", () => {
    expect(applyCustomValues(fields, { budget: "1000.0000", segment: "o1" }, { segment: null }))
      .toEqual({ budget: "1000.0000" });
  });

  it("refuses a field of another board", () => {
    expect(refused(() => applyCustomValues(fields, {}, { elsewhere: "x" }))).toBe(true);
  });

  it("drops stored values of fields that no longer exist", () => {
    expect(applyCustomValues(fields, { gone: "x", budget: "1.0000" }, undefined)).toEqual({ budget: "1.0000" });
  });
});

describe("field names", () => {
  const existing = [{ id: "f1", name: "Бюджет" }];

  it("refuses a name used on the board in any case", () => {
    expect(refused(() => assertFieldName(existing, "бюджет"))).toBe(true);
  });

  it("lets a field keep its own name", () => {
    expect(refused(() => assertFieldName(existing, "БЮДЖЕТ", "f1"))).toBe(false);
  });

  it.each(BUILT_IN_FIELD_NAMES)("refuses the built-in row %s", (name) => {
    expect(refused(() => assertFieldName([], name.toUpperCase()))).toBe(true);
  });

  it("pins the built-in rows of the lead card", () => {
    expect(BUILT_IN_FIELD_NAMES).toEqual([
      "Сумма сделки", "Ответственный", "Компания", "Метки", "Услуга", "Номер телефона",
      "Telegram", "Мессенджер", "Email", "Сайт", "Источник", "Описание",
    ]);
  });
});

describe("list options", () => {
  let next = 0;
  const newId = () => `new${++next}`;

  it("keeps identity on rename, recolor and reorder and reports removals", () => {
    const settled = settleOptions("SELECT", OPTIONS, [
      { id: "o2", name: "Small", color: "gray" },
      { id: "o1", name: "Опт", color: "blue" },
      { name: "Новый", color: "purple" },
    ], newId);

    expect(settled.options).toEqual([
      { id: "o2", name: "Small", color: "gray" },
      { id: "o1", name: "Опт", color: "blue" },
      { id: expect.stringMatching(/^new/), name: "Новый", color: "purple" },
    ]);
    expect(settled.removed).toEqual(["o3"]);
  });

  it("keeps the options when none are sent", () => {
    expect(settleOptions("MULTI_SELECT", OPTIONS, undefined, newId)).toEqual({ options: OPTIONS, removed: [] });
  });

  it.each([
    ["no options", []],
    ["equal names", [{ name: "Опт", color: "blue" }, { name: "опт", color: "red" }]],
    ["an unknown id", [{ id: "zz", name: "Опт", color: "blue" }]],
    ["an id twice", [{ id: "o1", name: "A", color: "blue" }, { id: "o1", name: "B", color: "blue" }]],
    ["too many", Array.from({ length: OPTION_LIMIT + 1 }, (_, index) => ({ name: `O${index}`, color: "gray" }))],
  ] as const)("refuses %s", (_, requested) => {
    expect(refused(() => settleOptions("SELECT", OPTIONS, requested as never, newId))).toBe(true);
  });

  it("refuses options on a field that is not a list", () => {
    expect(refused(() => settleOptions("TEXT", [], [{ name: "Опт", color: "blue" }], newId))).toBe(true);
    expect(settleOptions("TEXT", [], undefined, newId)).toEqual({ options: [], removed: [] });
  });
});

describe("removing options from values", () => {
  it("clears a single choice holding a removed option", () => {
    expect(withoutOptions({ segment: "o3", other: "x" }, "segment", new Set(["o3"]))).toEqual({ other: "x" });
  });

  it("keeps the remaining options of a multiple choice", () => {
    expect(withoutOptions({ segment: ["o1", "o3"] }, "segment", new Set(["o3"]))).toEqual({ segment: ["o1"] });
  });

  it("clears a multiple choice left empty", () => {
    expect(withoutOptions({ segment: ["o3"] }, "segment", new Set(["o3"]))).toEqual({});
  });

  it("reports no change when the value does not hold a removed option", () => {
    expect(withoutOptions({ segment: "o1" }, "segment", new Set(["o3"]))).toBeNull();
    expect(withoutOptions({}, "segment", new Set(["o3"]))).toBeNull();
  });
});
