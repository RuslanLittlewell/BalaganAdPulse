import { describe, expect, it } from "vitest";
import { onboardingSteps, stepsFor, type StepFacts } from "../../src/modules/onboarding/index.js";

const nothing: StepFacts = {
  clients: 0, projects: 0, adAccounts: 0, otherStaff: 0, pendingEmployeeInvites: 0,
  kpiTarget: false, telegramLinked: false, profileFilled: false,
};

describe("the steps of a role", () => {
  it("gives an admin six steps in order when the bot is offered and the tariff has room", () => {
    expect(stepsFor({ role: "ADMIN", userLimit: 5, telegramOffered: true }))
      .toEqual(["client", "project", "adAccount", "team", "kpi", "telegram"]);
  });

  it("leaves out inviting an employee when the tariff allows one user", () => {
    expect(stepsFor({ role: "ADMIN", userLimit: 1, telegramOffered: true })).not.toContain("team");
    expect(stepsFor({ role: "ADMIN", userLimit: null, telegramOffered: true })).toContain("team");
  });

  it("leaves out the bot when it is not offered", () => {
    expect(stepsFor({ role: "ADMIN", userLimit: null, telegramOffered: false }))
      .toEqual(["client", "project", "adAccount", "team", "kpi"]);
    expect(stepsFor({ role: "MANAGER", userLimit: null, telegramOffered: false })).toEqual(["profile"]);
  });

  it("gives a manager the profile and the bot", () => {
    expect(stepsFor({ role: "MANAGER", userLimit: 1, telegramOffered: true })).toEqual(["profile", "telegram"]);
  });

  it.each(["GUEST", "CLIENT", "CLIENT_ADMIN"] as const)("gives %s no steps", (role) => {
    expect(stepsFor({ role, userLimit: null, telegramOffered: true })).toEqual([]);
  });
});

describe("whether a step is done", () => {
  const admin = { role: "ADMIN" as const, userLimit: null, telegramOffered: true };

  it("reads every step of a fresh organization as not done", () => {
    expect(onboardingSteps(admin, nothing).every((step) => !step.done)).toBe(true);
  });

  it("reads each step from its own fact", () => {
    const done = (facts: Partial<StepFacts>) =>
      onboardingSteps(admin, { ...nothing, ...facts }).filter((step) => step.done).map((step) => step.key);
    expect(done({ clients: 1 })).toEqual(["client"]);
    expect(done({ projects: 2 })).toEqual(["project"]);
    expect(done({ adAccounts: 1 })).toEqual(["adAccount"]);
    expect(done({ otherStaff: 1 })).toEqual(["team"]);
    expect(done({ pendingEmployeeInvites: 1 })).toEqual(["team"]);
    expect(done({ kpiTarget: true })).toEqual(["kpi"]);
    expect(done({ telegramLinked: true })).toEqual(["telegram"]);
  });

  it("reads a manager's profile as done once a phone or a Telegram name is there", () => {
    expect(onboardingSteps({ role: "MANAGER", userLimit: null, telegramOffered: false }, { ...nothing, profileFilled: true }))
      .toEqual([{ key: "profile", done: true }]);
  });
});
