const listeners = new Set<() => void>();

export function onTrialEnded(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportTrialEnded(): void {
  listeners.forEach((listener) => listener());
}

export function refusesEndedTrial(status: number, details: readonly unknown[]): boolean {
  const first = details[0] as { code?: unknown } | undefined;
  return status === 403 && first?.code === "TRIAL_ENDED";
}
