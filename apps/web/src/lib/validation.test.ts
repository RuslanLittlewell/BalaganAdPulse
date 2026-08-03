import { isEmail, isPartialDecimal } from "./validation.js";

describe("isEmail", () => {
  it("accepts an address with a dotted domain", () => {
    expect(isEmail("buyer@acme.com")).toBe(true);
    expect(isEmail("a.b+tag@sub.acme.co.uk")).toBe(true);
  });

  it("rejects what the server's z.email() rejects", () => {
    expect(isEmail("acme.com")).toBe(false);
    expect(isEmail("buyer@acme")).toBe(false);
    expect(isEmail("buyer@@acme.com")).toBe(false);
    expect(isEmail("buyer @acme.com")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});

describe("isPartialDecimal", () => {
  it("accepts digits and a single decimal point, including part-way input", () => {
    expect(isPartialDecimal("")).toBe(true);
    expect(isPartialDecimal("1000")).toBe(true);
    expect(isPartialDecimal("12.")).toBe(true);
    expect(isPartialDecimal("12.50")).toBe(true);
    expect(isPartialDecimal(".5")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPartialDecimal("12a")).toBe(false);
    expect(isPartialDecimal("1.2.3")).toBe(false);
    expect(isPartialDecimal("-1")).toBe(false);
    expect(isPartialDecimal("1e3")).toBe(false);
    expect(isPartialDecimal("1 000")).toBe(false);
  });
});
