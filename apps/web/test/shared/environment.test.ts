import { http, HttpResponse } from "msw";
import { server } from "./server.js";

it("passes cancellation through native Request and fetch", async () => {
  server.use(http.get("/api/environment-check", () => HttpResponse.json({ ok: true })));
  const controller = new AbortController();
  const request = new Request("http://localhost:3000/api/environment-check", { signal: controller.signal });

  expect(await (await fetch(request)).json()).toEqual({ ok: true });
  controller.abort();
  expect(request.signal.aborted).toBe(true);
  await expect(fetch(request)).rejects.toMatchObject({ name: "AbortError" });
});

it("cancels an in-flight fetch with the same signal used by DOM listeners", async () => {
  let started!: () => void;
  let finish!: () => void;
  const entered = new Promise<void>((resolve) => { started = resolve; });
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  server.use(http.get("/api/environment-check", async () => {
    started();
    await pending;
    return HttpResponse.json({ ok: true });
  }));
  const controller = new window.AbortController();
  const listener = vi.fn();
  document.addEventListener("environment-check", listener, { signal: controller.signal });
  const request = fetch("/api/environment-check", { signal: controller.signal });
  const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
  await entered;
  controller.abort();
  finish();
  await rejected;
  document.dispatchEvent(new Event("environment-check"));
  expect(listener).not.toHaveBeenCalled();
});

it("detaches DOM listeners on abort without changing their other options", () => {
  const controller = new AbortController();
  const listener = vi.fn();
  document.addEventListener("environment-check", listener, { signal: controller.signal, once: true });
  window.addEventListener("environment-check", listener, { signal: controller.signal });
  document.dispatchEvent(new Event("environment-check"));
  document.dispatchEvent(new Event("environment-check"));
  expect(listener).toHaveBeenCalledTimes(1);

  controller.abort();
  window.dispatchEvent(new Event("environment-check"));
  expect(listener).toHaveBeenCalledTimes(1);
});

it("does not register DOM listeners with an already aborted signal", () => {
  const listener = vi.fn();
  document.addEventListener("environment-check", listener, { signal: AbortSignal.abort() });
  document.dispatchEvent(new Event("environment-check"));
  expect(listener).not.toHaveBeenCalled();
});
