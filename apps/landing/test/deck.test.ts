import { describe, expect, it } from "vitest";
import {
  HOLD,
  copyOpacity,
  currentOf,
  fanPose,
  fillOf,
  introOpacity,
  poseOf,
  positionAt,
  progressFor,
  type Pose,
} from "../src/scripts/deck";

const COUNT = 6;

describe("where the deck stands as the visitor scrolls", () => {
  it("opens on the fan and ends on the last module", () => {
    expect(positionAt(0, COUNT).shown).toBe(-1);
    expect(positionAt(1, COUNT).shown).toBe(COUNT - 1);
  });

  it("holds each module still before moving on", () => {
    const unit = 1 / (COUNT + 0.5);
    const arrived = positionAt(2 * unit, COUNT).shown;
    const held = positionAt(2 * unit + unit * HOLD * 0.9, COUNT).shown;

    expect(arrived).toBe(1);
    expect(held).toBe(1);
    expect(positionAt(2.6 * unit, COUNT).shown).toBeGreaterThan(1);
  });

  it("never runs backwards while the visitor scrolls forwards", () => {
    let previous = -Infinity;
    for (let progress = 0; progress <= 1; progress += 0.005) {
      const { shown } = positionAt(progress, COUNT);
      expect(shown).toBeGreaterThanOrEqual(previous);
      previous = shown;
    }
  });

  it("jumps to a point where the chosen module is in front and still", () => {
    for (let index = 0; index < COUNT; index++) {
      const { shown } = positionAt(progressFor(index, COUNT), COUNT);
      expect(shown).toBe(index);
      expect(currentOf(shown, COUNT)).toBe(index);
    }
  });
});

describe("how each imitation is placed", () => {
  it("starts fanned, the front one fully drawn and the far ones hidden", () => {
    for (const [key, value] of Object.entries(fanPose(0))) {
      expect(poseOf(0, -1)[key as keyof Pose]).toBeCloseTo(value);
    }
    expect(poseOf(0, -1).opacity).toBe(1);
    expect(poseOf(5, -1).opacity).toBe(0);
    expect(poseOf(1, -1).z).toBeLessThan(poseOf(0, -1).z);
  });

  it("brings the current module to the front, tilted, with the others hidden on either side", () => {
    const front = poseOf(2, 2);
    expect(front).toMatchObject({ x: 0, opacity: 1 });
    expect(front.rotateY).toBeLessThan(0);
    expect(poseOf(1, 2)).toMatchObject({ opacity: 0 });
    expect(poseOf(1, 2).x).toBeLessThan(0);
    expect(poseOf(3, 2)).toMatchObject({ opacity: 0 });
    expect(poseOf(3, 2).x).toBeGreaterThan(0);
  });
});

describe("what the copy and the progress row show", () => {
  it("shows the heading on the fan and only the current module's copy after it", () => {
    expect(introOpacity(-1)).toBe(1);
    expect(introOpacity(0)).toBe(0);
    expect(copyOpacity(3, 3)).toBe(1);
    expect(copyOpacity(2, 3)).toBe(0);
  });

  it("fills a module's line as the visitor scrolls through it", () => {
    expect(fillOf(2, 1.5, COUNT)).toBe(0);
    expect(fillOf(2, 2.5, COUNT)).toBe(0.5);
    expect(fillOf(2, 4, COUNT)).toBe(1);
    expect(fillOf(COUNT - 1, COUNT - 0.5, COUNT)).toBe(1);
  });
});
