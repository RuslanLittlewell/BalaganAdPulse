import { useAuth } from "@/features/auth/index.js";
import { useOnboardingFreshness } from "../api.js";
import { FirstStepsDialog } from "./FirstStepsDialog.js";
import { WelcomeDialog } from "./WelcomeDialog.js";

export function OnboardingLayer() {
  const { organization, platformAdmin } = useAuth();
  useOnboardingFreshness(organization != null && !platformAdmin);
  return (
    <>
      <WelcomeDialog />
      <FirstStepsDialog />
    </>
  );
}
