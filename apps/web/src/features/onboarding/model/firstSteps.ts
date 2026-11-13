import { create } from "zustand";
import { useAuth } from "@/features/auth/index.js";
import { useOnboarding, type Onboarding } from "../api.js";

interface FirstStepsDialogState {
  open: boolean;
  show: () => void;
  close: () => void;
}

export const useFirstStepsDialog = create<FirstStepsDialogState>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));

export const remainingSteps = (onboarding: Onboarding | undefined) =>
  onboarding == null || onboarding.hidden ? 0 : onboarding.steps.filter((step) => !step.done).length;

export function useFirstSteps() {
  const { organization, platformAdmin, role } = useAuth();
  const onboarding = useOnboarding(organization != null && !platformAdmin && role !== "PARTNER");
  const data = onboarding.data;
  const total = data?.steps.length ?? 0;
  const done = data?.steps.filter((step) => step.done).length ?? 0;
  return { visible: remainingSteps(data) > 0, done, total };
}
