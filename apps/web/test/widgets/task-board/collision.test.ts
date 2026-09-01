import type { CollisionDetection } from "@dnd-kit/core";
import { boardCollisionDetection } from "@/widgets/task-board/collision.js";

/** A rect in dnd-kit's shape. */
function rect(left: number, top: number, width = 320, height = 600) {
  return { width, height, top, left, right: left + width, bottom: top + height };
}

const IDEA = rect(0, 0);
const DONE = rect(340, 0);

function argsAt(x: number, y: number): Parameters<CollisionDetection>[0] {
  const droppableRects = new Map([["IDEA", IDEA], ["DONE", DONE]]);
  const containers = [
    { id: "IDEA", rect: { current: IDEA }, data: { current: {} }, disabled: false },
    { id: "DONE", rect: { current: DONE }, data: { current: {} }, disabled: false },
  ];
  return {
    active: { id: "card", data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    // The card itself is still mostly over IDEA — only the cursor has crossed.
    collisionRect: rect(x - 150, y - 40, 300, 120),
    droppableRects,
    droppableContainers: containers,
    pointerCoordinates: { x, y },
  } as unknown as Parameters<CollisionDetection>[0];
}

describe("what the board considers the drop target", () => {
  it("follows the cursor, so a card lands as soon as the pointer crosses over", () => {
    // Cursor just inside DONE; the card's own rect still overlaps IDEA more.
    const collisions = boardCollisionDetection(argsAt(360, 100));
    expect(collisions[0]?.id).toBe("DONE");
  });

  it("stays with the column the cursor is still in", () => {
    expect(boardCollisionDetection(argsAt(160, 100))[0]?.id).toBe("IDEA");
  });

  it("falls back to the nearest column when the cursor is outside every one", () => {
    // Dragged off the bottom of the board — still has to land somewhere.
    const collisions = boardCollisionDetection(argsAt(160, 900));
    expect(collisions[0]?.id).toBe("IDEA");
  });

  it("answers nothing when there is nowhere to drop", () => {
    const empty = {
      ...argsAt(160, 100),
      droppableRects: new Map(),
      droppableContainers: [],
    } as unknown as Parameters<CollisionDetection>[0];
    expect(boardCollisionDetection(empty)).toEqual([]);
  });
});
