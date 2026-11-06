import type { Role } from "@adpulse/access-policy";

export const ONBOARDING_STEPS = ["client", "project", "adAccount", "team", "kpi", "telegram", "profile"] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

const STEPS_BY_ROLE: Readonly<Partial<Record<Role, readonly OnboardingStepKey[]>>> = {
  ADMIN: ["client", "project", "adAccount", "team", "kpi", "telegram"],
  MANAGER: ["profile", "telegram"],
};

export interface StepFacts {
  readonly clients: number;
  readonly projects: number;
  readonly adAccounts: number;
  readonly otherStaff: number;
  readonly pendingEmployeeInvites: number;
  readonly kpiTarget: boolean;
  readonly telegramLinked: boolean;
  readonly profileFilled: boolean;
}

export interface StepContext {
  readonly role: Role;
  readonly userLimit: number | null;
  readonly telegramOffered: boolean;
}

export interface OnboardingStep {
  readonly key: OnboardingStepKey;
  readonly done: boolean;
}

function applies(step: OnboardingStepKey, context: StepContext): boolean {
  if (step === "team") return context.userLimit !== 1;
  if (step === "telegram") return context.telegramOffered;
  return true;
}

function isDone(step: OnboardingStepKey, facts: StepFacts): boolean {
  switch (step) {
    case "client": return facts.clients > 0;
    case "project": return facts.projects > 0;
    case "adAccount": return facts.adAccounts > 0;
    case "team": return facts.otherStaff + facts.pendingEmployeeInvites > 0;
    case "kpi": return facts.kpiTarget;
    case "telegram": return facts.telegramLinked;
    case "profile": return facts.profileFilled;
  }
}

export function stepsFor(context: StepContext): OnboardingStepKey[] {
  return (STEPS_BY_ROLE[context.role] ?? []).filter((step) => applies(step, context));
}

export function onboardingSteps(context: StepContext, facts: StepFacts): OnboardingStep[] {
  return stepsFor(context).map((key) => ({ key, done: isDone(key, facts) }));
}
