import "./storage-setup.js";
import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { installFakeAnimate } from "./animations.js";

expect.extend(matchers);

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
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
for (const method of ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, { value: () => false, configurable: true });
  }
}
installFakeAnimate();
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
import { resetProjects } from "@/entities/project/index.js";
import { useModuleMemory } from "@/shared/lib/index.js";
import { useSummaryTiles } from "@/widgets/agency-overview/summaryTiles.js";
import { useColumnWidths } from "@/widgets/performance-table/columnWidths.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  resetStaff();
  resetProjects();
  useModuleMemory.setState({ boards: {}, projectPlaces: {}, taskCalendarZooms: {} });
  useSummaryTiles.setState({ layouts: {} });
  useColumnWidths.setState({ nameWidths: {}, visibleColumns: {} });
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
