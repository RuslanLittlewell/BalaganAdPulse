import { describe, expect, it } from "vitest";
import {
  ALWAYS_ON_MODULES,
  MODULES,
  OPTIONAL_MODULES,
  enabledModules,
  isOptionalModule,
} from "../src/index.js";

describe("organization modules", () => {
  it("splits every module into always-on and optional", () => {
    expect([...ALWAYS_ON_MODULES, ...OPTIONAL_MODULES]).toEqual([...MODULES]);
    expect(ALWAYS_ON_MODULES).toEqual(["DASHBOARD", "PROJECTS"]);
    expect(OPTIONAL_MODULES).toEqual(["CRM", "TASKS", "REPORTS"]);
  });

  it("recognises only the optional modules as optional", () => {
    expect(OPTIONAL_MODULES.every(isOptionalModule)).toBe(true);
    expect(isOptionalModule("DASHBOARD")).toBe(false);
    expect(isOptionalModule("PROJECTS")).toBe(false);
    expect(isOptionalModule("BILLING")).toBe(false);
  });

  it("always enables the dashboard and projects", () => {
    expect(enabledModules([])).toEqual(["DASHBOARD", "PROJECTS"]);
  });

  it("adds the optional modules in a fixed order whatever order they are given in", () => {
    expect(enabledModules(["REPORTS", "CRM"])).toEqual(["DASHBOARD", "PROJECTS", "CRM", "REPORTS"]);
    expect(enabledModules(["TASKS", "REPORTS", "CRM"])).toEqual([...MODULES]);
  });
});
