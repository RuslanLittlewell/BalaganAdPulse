import { InvalidValueError, normalizeInput, toInputValue } from "./sheetValue.js";

describe("toInputValue", () => {
  it("trims the trailing zeros the API pads values with", () => {
    expect(toInputValue("1250.0000", "MONEY")).toBe("1250");
    expect(toInputValue("2.6700", "PERCENT")).toBe("2.67");
    expect(toInputValue("10.0100", "NUMBER")).toBe("10.01");
    expect(toInputValue("0.0001", "NUMBER")).toBe("0.0001");
  });

  it("returns an empty string for an empty cell", () => {
    expect(toInputValue(null, "MONEY")).toBe("");
    expect(toInputValue(null, "TEXT")).toBe("");
  });

  it("leaves text untouched", () => {
    expect(toInputValue("good day", "TEXT")).toBe("good day");
    expect(toInputValue("1250.0000", "TEXT")).toBe("1250.0000");
  });
});

describe("normalizeInput", () => {
  it("maps an empty or blank input to null, which clears the cell", () => {
    expect(normalizeInput("", "MONEY")).toBeNull();
    expect(normalizeInput("   ", "TEXT")).toBeNull();
  });

  it("reads a comma as a decimal separator", () => {
    expect(normalizeInput("1250,5", "MONEY")).toBe("1250.5");
  });

  it("trims and passes through valid numbers, negatives included", () => {
    expect(normalizeInput(" 1250 ", "MONEY")).toBe("1250");
    expect(normalizeInput("-12.5", "NUMBER")).toBe("-12.5");
  });

  it("trims text without validating it", () => {
    expect(normalizeInput("  good day  ", "TEXT")).toBe("good day");
  });

  it("rejects input a numeric property cannot store", () => {
    expect(() => normalizeInput("abc", "MONEY")).toThrow(InvalidValueError);
    expect(() => normalizeInput("12.5.7", "NUMBER")).toThrow(InvalidValueError);
    expect(() => normalizeInput("1 250", "MONEY")).toThrow(InvalidValueError);
  });
});
