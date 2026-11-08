import { act, renderHook } from "@testing-library/react";
import { useMutation } from "@tanstack/react-query";
import { hookWrapper } from "@test/shared/index.js";
import {
  onboardingApi, onboardingKey, useHideFirstSteps, useOnboarding, useOnboardingFreshness, type Onboarding,
} from "@/features/onboarding/api.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const state = (change: Partial<Onboarding> = {}): Onboarding => ({
  welcomed: true, hidden: false, firstProjectId: "p1", steps: [{ key: "client", done: false }], ...change,
});

it.each([
  { hidden: true },
  { steps: [{ key: "client" as const, done: true }] },
  { steps: [] },
])("stops polling terminal onboarding: %j", async (change) => {
  vi.useFakeTimers();
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(onboardingKey, state(change));
  const get = vi.spyOn(onboardingApi, "get");
  const view = renderHook(() => useOnboarding(true), { wrapper });
  await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
  expect(get).not.toHaveBeenCalled();
  view.unmount();
  wrapper.client.clear();
});

it("ignores unrelated successful mutations", async () => {
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(onboardingKey, state());
  const invalidate = vi.spyOn(wrapper.client, "invalidateQueries");
  const view = renderHook(() => {
    useOnboardingFreshness(true);
    return useMutation({ mutationFn: async () => undefined });
  }, { wrapper });
  await act(async () => { await view.result.current.mutateAsync(); });
  expect(invalidate).not.toHaveBeenCalled();
  view.unmount();
  wrapper.client.clear();
});

it("does not refresh hidden onboarding after relevant mutations", async () => {
  const wrapper = hookWrapper();
  wrapper.client.setQueryData(onboardingKey, state({ hidden: true }));
  const invalidate = vi.spyOn(wrapper.client, "invalidateQueries");
  const view = renderHook(() => {
    useOnboardingFreshness(true);
    return useMutation({ mutationFn: async () => undefined, meta: { affectsOnboarding: true } });
  }, { wrapper });
  await act(async () => { await view.result.current.mutateAsync(); });
  expect(invalidate).not.toHaveBeenCalled();
  view.unmount();
  wrapper.client.clear();
});

it("restores the visible list when hiding it fails", async () => {
  const wrapper = hookWrapper();
  const previous = state();
  wrapper.client.setQueryData(onboardingKey, previous);
  vi.spyOn(onboardingApi, "hide").mockRejectedValue(new Error("Unavailable"));
  const view = renderHook(() => useHideFirstSteps(), { wrapper });
  await act(async () => { await view.result.current.mutateAsync().catch(() => {}); });
  expect(wrapper.client.getQueryData(onboardingKey)).toEqual(previous);
  view.unmount();
  wrapper.client.clear();
});
