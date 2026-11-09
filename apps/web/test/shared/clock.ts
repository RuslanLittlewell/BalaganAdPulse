import { afterEach, beforeEach, vi } from "vitest";

export function freezeDate(iso: string) {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
  });
  afterEach(() => { vi.useRealTimers(); });
}
