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
  get: (signal?: AbortSignal) => http.get<Onboarding>("/onboarding", { signal }),
  welcome: () => http.post<void>("/onboarding/welcome", {}),
  hide: () => http.post<void>("/onboarding/hide", {}),
};

function needsRefresh(data: Onboarding | undefined): boolean {
  return !data || !data.welcomed || (!data.hidden && data.steps.some((step) => !step.done));
}

export function useOnboarding(enabled: boolean) {
  return useQuery({
    queryKey: onboardingKey,
    queryFn: ({ signal }) => onboardingApi.get(signal),
    enabled,
    staleTime: (query) => needsRefresh(query.state.data) ? ONBOARDING_REFRESH_MS : Infinity,
    refetchInterval: (query) => needsRefresh(query.state.data) ? ONBOARDING_REFRESH_MS : false,
  });
}

export function useOnboardingFreshness(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success"
        && event.mutation.options.meta?.affectsOnboarding === true
        && !queryClient.getQueryData<Onboarding>(onboardingKey)?.hidden) {
        void queryClient.invalidateQueries({ queryKey: onboardingKey });
      }
    });
  }, [enabled, queryClient]);
}

function useOnboardingMark(send: () => Promise<void>, change: Partial<Onboarding>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: onboardingKey });
      const previous = queryClient.getQueryData<Onboarding>(onboardingKey);
      queryClient.setQueryData<Onboarding>(onboardingKey, (current) => current && { ...current, ...change });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(onboardingKey, context.previous);
    },
  });
}

export const useWelcomed = () => useOnboardingMark(onboardingApi.welcome, { welcomed: true });

export const useHideFirstSteps = () => useOnboardingMark(onboardingApi.hide, { hidden: true });
