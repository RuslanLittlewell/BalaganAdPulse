import { builtinEnvironments, type Environment } from "vitest/environments";

export default {
  ...builtinEnvironments.jsdom,
  async setup(global, options) {
    const nativeController: typeof AbortController = global.AbortController;
    const nativeSignal: typeof AbortSignal = global.AbortSignal;
    const environment = await builtinEnvironments.jsdom.setup(global, options);
    const browserController: typeof AbortController = global.AbortController;
    const browserSignal: typeof AbortSignal = global.AbortSignal;
    const target: typeof EventTarget.prototype = global.EventTarget.prototype;
    const addEventListener = target.addEventListener;
    const controllers = new WeakMap<AbortSignal, AbortController>();

    target.addEventListener = function (type, listener, options) {
      if (typeof options === "object" && options?.signal && !browserSignal.prototype.isPrototypeOf(options.signal)) {
        const signal = options.signal;
        let controller = controllers.get(signal);
        if (!controller) {
          const adapted = new browserController();
          controller = adapted;
          controllers.set(signal, controller);
          if (signal.aborted) adapted.abort(signal.reason);
          else signal.addEventListener("abort", () => adapted.abort(signal.reason), { once: true });
        }
        return addEventListener.call(this, type, listener, { ...options, signal: controller.signal });
      }
      return addEventListener.call(this, type, listener, options);
    };

    global.AbortController = nativeController;
    global.AbortSignal = nativeSignal;
    global.jsdom.window.AbortController = nativeController;
    global.jsdom.window.AbortSignal = nativeSignal;
    global.addEventListener = target.addEventListener.bind(global.jsdom.window);

    return {
      async teardown(global) {
        target.addEventListener = addEventListener;
        await environment.teardown(global);
      },
    };
  },
} satisfies Environment;
