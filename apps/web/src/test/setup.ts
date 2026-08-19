import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

// Node 26 defines a global `localStorage` stub that returns undefined without
// --localstorage-file. Vitest's jsdom environment leaves any key already present
// on globalThis alone, so jsdom's own Storage instance never lands as the public
// getter. Install jsdom's real Storage here: in-memory and per worker, avoiding
// the shared-file cross-contamination that would occur with disk-backed storage
// across parallel workers. Fail loudly if the storage is not found, since this
// shim is infrastructure for all auth tests in this phase, and silent failure
// would surface much later as mysterious errors in unrelated tests.
const jsdomStorage = (window as unknown as { _localStorage?: Storage })._localStorage;
if (!jsdomStorage) {
  throw new Error(
    "jsdom's local storage was not found at window._localStorage — the test " +
      "environment cannot provide localStorage. See apps/web/src/test/setup.ts.",
  );
}
Object.defineProperty(globalThis, "localStorage", {
  value: jsdomStorage,
  configurable: true,
});

// jsdom does not implement the native <dialog> methods; provide the minimum
// our Dialog component relies on so component tests can run.
if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}

import { server } from "./server.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
