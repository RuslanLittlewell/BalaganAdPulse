import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

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

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
for (const method of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, { value: () => false, configurable: true });
  }
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
if (!HTMLImageElement.prototype.decode) {
  HTMLImageElement.prototype.decode = async () => {};
}
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: () => ({ drawImage: () => {} }),
  configurable: true,
});
Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
  value: (callback: BlobCallback, type?: string) => {
    callback(new Blob([], { type: type ?? "image/png" }));
  },
  configurable: true,
});
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* iterator() {},
  }) as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

import { server } from "./server.js";
import { resetStaff } from "@/entities/membership/index.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetStaff();
});
afterAll(() => server.close());

let objectUrlCount = 0;
const objectUrls = new Map<string, Blob>();

if (!URL.createObjectURL) {
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:test/${(objectUrlCount += 1)}`;
    objectUrls.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = (url: string) => { objectUrls.delete(url); };
}
