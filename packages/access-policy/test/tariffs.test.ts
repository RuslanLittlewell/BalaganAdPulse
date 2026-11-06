import { describe, expect, it } from "vitest";
import {
  isTariff,
  isTrialExpired,
  TARIFF_PLANS,
  TARIFFS,
  tariffModules,
  tariffsWithModule,
  trialEndsAtFrom,
} from "../src/index.js";

describe("the tariff catalogue", () => {
  it("lists the six tariffs, cheapest first", () => {
    expect(TARIFFS).toEqual(["TRIAL", "SOLO", "BUSINESS", "AGENCY", "AGENCY_PRO", "ENTERPRISE"]);
  });

  it.each([
    ["SOLO", { projects: 5, clients: null, users: 1, adAccounts: null }, []],
    ["BUSINESS", { projects: null, clients: 1, users: 3, adAccounts: 3 }, ["CRM"]],
    ["AGENCY", { projects: 15, clients: 15, users: 5, adAccounts: null }, ["CRM", "TASKS", "REPORTS"]],
    ["AGENCY_PRO", { projects: 40, clients: 40, users: 15, adAccounts: null }, ["CRM", "TASKS", "REPORTS"]],
    ["ENTERPRISE", { projects: null, clients: null, users: null, adAccounts: null }, ["CRM", "TASKS", "REPORTS"]],
  ] as const)("gives %s its limits and modules", (tariff, limits, modules) => {
    expect(TARIFF_PLANS[tariff].limits).toEqual(limits);
    expect(tariffModules(tariff)).toEqual(modules);
  });

  it("gives the trial what Agency has", () => {
    expect(TARIFF_PLANS.TRIAL).toEqual(TARIFF_PLANS.AGENCY);
  });

  it("names the tariffs that include a module", () => {
    expect(tariffsWithModule("CRM")).toEqual(["TRIAL", "BUSINESS", "AGENCY", "AGENCY_PRO", "ENTERPRISE"]);
    expect(tariffsWithModule("TASKS")).toEqual(["TRIAL", "AGENCY", "AGENCY_PRO", "ENTERPRISE"]);
  });

  it("recognises a tariff by name", () => {
    expect(isTariff("AGENCY_PRO")).toBe(true);
    expect(isTariff("PLATINUM")).toBe(false);
  });
});

describe("the trial", () => {
  const start = new Date("2026-11-01T10:00:00Z");

  it("ends fourteen days after it starts", () => {
    expect(trialEndsAtFrom(start)).toEqual(new Date("2026-11-15T10:00:00Z"));
  });

  it("is expired from its end on, and only on the trial tariff", () => {
    const trialEndsAt = trialEndsAtFrom(start);
    expect(isTrialExpired({ tariff: "TRIAL", trialEndsAt }, new Date("2026-11-15T09:59:59Z"))).toBe(false);
    expect(isTrialExpired({ tariff: "TRIAL", trialEndsAt }, trialEndsAt)).toBe(true);
    expect(isTrialExpired({ tariff: "BUSINESS", trialEndsAt }, new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(isTrialExpired({ tariff: "TRIAL", trialEndsAt: null }, new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });
});
