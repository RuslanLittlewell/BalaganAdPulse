import { act, renderHook } from "@testing-library/react";
import { ApiError } from "@/shared/lib/http.js";
import { AUTOSAVE_DELAY_MS, useAutosave } from "@/widgets/project-documents/useAutosave.js";

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const options = { revision: 1, storageKey: "audit-draft:user:project:doc" };
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS); });

it("retains failed content and merges a newer title before retrying", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({ revision: 2 });
  const view = renderHook(() => useAutosave(save, options));
  const content = { type: "doc", content: [] };
  act(() => view.result.current.schedule({ content }));
  await tick();
  expect(view.result.current.status).toBe("failed");
  act(() => view.result.current.schedule({ title: "New" }));
  await tick();
  expect(save).toHaveBeenLastCalledWith({ content, title: "New" }, 1);
  expect(view.result.current.status).toBe("saved");
  expect(localStorage.getItem(options.storageKey)).toBeNull();
});

it("keeps newer edits dirty until a sequential save acknowledges them", async () => {
  let finish: ((value: { revision: number }) => void) | undefined;
  const save = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue({ revision: 3 });
  const view = renderHook(() => useAutosave(save, options));
  act(() => view.result.current.schedule({ title: "First" }));
  await tick();
  act(() => view.result.current.schedule({ title: "Latest" }));
  await tick();
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { finish?.({ revision: 2 }); });
  expect(view.result.current.status).toBe("saving");
  await tick();
  expect(save).toHaveBeenLastCalledWith({ title: "Latest" }, 2);
  expect(view.result.current.status).toBe("saved");
});

it("persists and flushes on page departure, then restores an unacknowledged draft", async () => {
  const fail = vi.fn().mockRejectedValue(new Error("Offline"));
  const first = renderHook(() => useAutosave(fail, options));
  act(() => first.result.current.schedule({ title: "Recover me" }));
  await act(async () => { window.dispatchEvent(new Event("pagehide")); });
  expect(fail).toHaveBeenCalledWith({ title: "Recover me" }, 1);
  first.unmount();
  const save = vi.fn().mockResolvedValue({ revision: 2 });
  const second = renderHook(() => useAutosave(save, options));
  expect(second.result.current.initialChange).toEqual({ title: "Recover me" });
  await tick();
  expect(save).toHaveBeenCalledWith({ title: "Recover me" }, 1);
  expect(localStorage.getItem(options.storageKey)).toBeNull();
});

it("preserves conflicting edits until the member explicitly chooses a newer revision", async () => {
  const save = vi.fn().mockRejectedValueOnce(new ApiError("Conflict", 409)).mockResolvedValue({ revision: 5 });
  const view = renderHook(() => useAutosave(save, options));
  act(() => view.result.current.schedule({ title: "Mine" }));
  await tick();
  expect(view.result.current.status).toBe("conflict");
  act(() => view.result.current.schedule({ title: "Mine, amended" }));
  await tick();
  expect(save).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(options.storageKey)).toContain("Mine, amended");
  await act(async () => { await view.result.current.retry(4); });
  expect(save).toHaveBeenLastCalledWith({ title: "Mine, amended" }, 4);
  expect(view.result.current.status).toBe("saved");
});

it("does not restore another user's document key", () => {
  localStorage.setItem(options.storageKey, JSON.stringify({ revision: 1, change: { title: "Private" }, writer: "old" }));
  const view = renderHook(() => useAutosave(vi.fn(), { revision: 1, storageKey: "another-user:doc" }));
  expect(view.result.current.initialChange).toBeUndefined();
});

it("reports draft storage failure and keeps a failed save dirty for a manual retry", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
  const save = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({ revision: 2 });
  const view = renderHook(() => useAutosave(save, options));
  act(() => view.result.current.schedule({ title: "Important" }));
  expect(view.result.current.storageFailed).toBe(true);
  await tick();
  expect(view.result.current.status).toBe("failed");
  await tick();
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { await view.result.current.retry(); });
  expect(save).toHaveBeenLastCalledWith({ title: "Important" }, 1);
  expect(view.result.current.status).toBe("saved");
});

it("saves queued edits after an in-flight save completes following unmount", async () => {
  let finish: ((value: { revision: number }) => void) | undefined;
  const save = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue({ revision: 3 });
  const view = renderHook(() => useAutosave(save, options));
  act(() => view.result.current.schedule({ title: "First" }));
  await tick();
  act(() => view.result.current.schedule({ title: "Last" }));
  view.unmount();
  await act(async () => { finish?.({ revision: 2 }); });
  expect(save).toHaveBeenLastCalledWith({ title: "Last" }, 2);
  expect(localStorage.getItem(options.storageKey)).toBeNull();
});
