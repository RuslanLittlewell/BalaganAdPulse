import type { Tariff } from "@adpulse/access-policy";
import type { ActorContext, Clock } from "#shared/application/index.js";
import type { StepFacts } from "../domain/steps.js";

export type OrganizationFacts = Omit<StepFacts, "telegramLinked">;

export interface OnboardingSnapshot {
  readonly tariff: Tariff;
  readonly welcomedAt: Date | null;
  readonly hiddenAt: Date | null;
  readonly firstProjectId: string | null;
  readonly facts: OrganizationFacts;
}

export interface OnboardingReader {
  read(actor: ActorContext): Promise<OnboardingSnapshot | null>;
}

export interface OnboardingMarks {
  welcome(membershipId: string, at: Date): Promise<void>;
  hide(membershipId: string, at: Date): Promise<void>;
}

export interface TelegramLinkStatus {
  status(actor: ActorContext): Promise<{ readonly available: boolean; readonly linked: boolean }>;
}

export interface OnboardingDependencies {
  readonly reader: OnboardingReader;
  readonly marks: OnboardingMarks;
  readonly telegram: TelegramLinkStatus;
  readonly clock: Clock;
}
