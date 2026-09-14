// Run before importing stores: persist captures localStorage during module evaluation.
const jsdomStorage = (window as unknown as { _localStorage?: Storage })._localStorage;
if (!jsdomStorage) {
  throw new Error("jsdom's local storage was not found at window._localStorage");
}
Object.defineProperty(globalThis, "localStorage", {
  value: jsdomStorage,
  configurable: true,
});
