export interface FakeAnimation {
  onfinish: (() => void) | null;
  playState: "running" | "paused" | "finished" | "idle";
  play(): void;
  pause(): void;
  cancel(): void;
  finish(): void;
}

const running = new Set<FakeAnimation>();

export function installFakeAnimate(): void {
  if ("animate" in HTMLElement.prototype) return;
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value(): FakeAnimation {
      const animation: FakeAnimation = {
        onfinish: null,
        playState: "running",
        play() { this.playState = "running"; },
        pause() { this.playState = "paused"; },
        cancel() { this.playState = "idle"; running.delete(this); },
        finish() {
          this.playState = "finished";
          running.delete(this);
          this.onfinish?.();
        },
      };
      running.add(animation);
      return animation;
    },
  });
}

export function finishAnimations(): void {
  for (const animation of [...running]) animation.finish();
}

export function resetAnimations(): void {
  running.clear();
}
