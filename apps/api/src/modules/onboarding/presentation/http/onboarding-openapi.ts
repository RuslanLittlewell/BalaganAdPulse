import { z } from "zod";
import { ref, type ComponentDocs, type RouteDoc } from "#shared/presentation/openapi.js";
import { ONBOARDING_STEPS } from "#modules/onboarding/domain/steps.js";

const onboarding = z.object({
  welcomed: z.boolean(),
  hidden: z.boolean(),
  steps: z.array(z.object({ key: z.enum(ONBOARDING_STEPS), done: z.boolean() })),
  firstProjectId: z.uuid().nullable(),
});

export const onboardingComponents: ComponentDocs = {
  Onboarding: onboarding,
};

export const onboardingDoc: RouteDoc = {
  tag: "Onboarding",
  tagDescription: "The welcome on a member's first visit and their list of first steps",
  operations: [
    {
      method: "get",
      path: "/",
      summary: "Read the caller's onboarding",
      description: "Whether the caller has been welcomed and has hidden the list, and the steps of their role with whether each is done, computed from the organization's data. An admin's steps: client, project, adAccount, team (left out when the tariff allows one user), kpi, telegram (left out when the bot is not offered). A manager's: profile, telegram. Other roles have none.",
      success: { status: 200, description: "The onboarding", schema: ref("Onboarding") },
      errors: [401, 403],
    },
    {
      method: "post",
      path: "/welcome",
      summary: "Record that the caller has seen the welcome",
      description: "Idempotent; the first time is kept. Open on an expired trial.",
      success: { status: 204, description: "Recorded" },
      errors: [401, 403],
    },
    {
      method: "post",
      path: "/hide",
      summary: "Hide the caller's list of first steps for good",
      description: "Idempotent; the first time is kept. Open on an expired trial.",
      success: { status: 204, description: "Recorded" },
      errors: [401, 403],
    },
  ],
};
