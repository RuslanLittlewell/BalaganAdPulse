import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/lib/index.js";

export const ONBOARDING_STEPS = ["client", "project", "adAccount", "team", "kpi", "telegram", "profile"] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
}

export interface Onboarding {
  welcomed: boolean;
  hidden: boolean;
  steps: OnboardingStep[];
  firstProjectId: string | null;
}

export const ONBOARDING_REFRESH_MS = 60_000;

export const onboardingKey = ["onboarding"] as const;

export const onboardingApi = {
  get: () => http.get<Onboarding>("/onboarding"),
  welcome: () => http.post<void>("/onboarding/welcome", {}),
  hide: () => http.post<void>("/onboarding/hide", {}),
};

export function useOnboarding(enabled: boolean) {
  return useQuery({
    queryKey: onboardingKey,
    queryFn: onboardingApi.get,
    enabled,
    refetchInterval: ONBOARDING_REFRESH_MS,
  });
}

export function useOnboardingFreshness(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        void queryClient.invalidateQueries({ queryKey: onboardingKey });
      }
    });
  }, [enabled, queryClient]);
}

function useOnboardingMark(send: () => Promise<void>, change: Partial<Onboarding>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onMutate: () => {
      queryClient.setQueryData<Onboarding>(onboardingKey, (current) => current && { ...current, ...change });
    },
  });
}

export const useWelcomed = () => useOnboardingMark(onboardingApi.welcome, { welcomed: true });

export const useHideFirstSteps = () => useOnboardingMark(onboardingApi.hide, { hidden: true });
