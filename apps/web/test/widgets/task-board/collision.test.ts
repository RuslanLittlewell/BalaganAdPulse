import type { CollisionDetection } from "@dnd-kit/core";
import { boardCollisionDetection } from "@/widgets/task-board/collision.js";
import { landingOf } from "@/shared/lib/index.js";

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
    collisionRect: rect(x - 150, y - 40, 300, 120),
    droppableRects,
    droppableContainers: containers,
    pointerCoordinates: { x, y },
  } as unknown as Parameters<CollisionDetection>[0];
}

describe("what the board considers the drop target", () => {
  it("follows the cursor, so a card lands as soon as the pointer crosses over", () => {
    const collisions = boardCollisionDetection(argsAt(360, 100));
    expect(collisions[0]?.id).toBe("DONE");
  });

  it("stays with the column the cursor is still in", () => {
    expect(boardCollisionDetection(argsAt(160, 100))[0]?.id).toBe("IDEA");
  });

  it("falls back to the nearest column when the cursor is outside every one", () => {
    const collisions = boardCollisionDetection(argsAt(160, 900));
    expect(collisions[0]?.id).toBe("IDEA");
  });

  describe("cards in the columns", () => {
    const card = (id: string, column: string, box: ReturnType<typeof rect>) =>
      ({ id, rect: { current: box }, data: { current: { sortable: { containerId: column } } }, disabled: false });
    const FIRST = rect(10, 60, 300, 100);
    const SECOND = rect(10, 170, 300, 100);
    const ELSEWHERE = rect(350, 60, 300, 100);

    function withCards(x: number, y: number, dragged = rect(x - 150, y - 50, 300, 100)) {
      const base = argsAt(x, y);
      const cards = [card("first", "IDEA", FIRST), card("second", "IDEA", SECOND), card("other", "DONE", ELSEWHERE)];
      return {
        ...base,
        collisionRect: dragged,
        droppableRects: new Map([...base.droppableRects, ["first", FIRST], ["second", SECOND], ["other", ELSEWHERE]]),
        droppableContainers: [...base.droppableContainers, ...cards],
      } as unknown as Parameters<CollisionDetection>[0];
    }

    it("is the card under the pointer", () => {
      expect(boardCollisionDetection(withCards(160, 200))[0]?.id).toBe("second");
    });

    it("is the nearest card of the column when the pointer is above its first card", () => {
      expect(boardCollisionDetection(withCards(160, 30))[0]?.id).toBe("first");
    });

    it("is the nearest card of the column when the pointer is between two cards", () => {
      expect(boardCollisionDetection(withCards(160, 165, rect(10, 70, 300, 100)))[0]?.id).toBe("first");
    });

    it("is never a card of another column", () => {
      expect(boardCollisionDetection(withCards(160, 500))[0]?.id).toBe("second");
    });

    it("is the column itself when the column holds no card", () => {
      const base = withCards(500, 400);
      const without = {
        ...base,
        droppableContainers: base.droppableContainers.filter((container) => container.id !== "other"),
      } as unknown as Parameters<CollisionDetection>[0];
      expect(boardCollisionDetection(without)[0]?.id).toBe("DONE");
    });
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

describe("where a dropped card's placeholder stands", () => {
  const over = (current: unknown) => ({ id: "x", rect: rect(0, 0), disabled: false, data: { current } }) as unknown as Parameters<typeof landingOf>[0];

  it("is the column and index of the card it is over", () => {
    expect(landingOf(over({ sortable: { containerId: "IDEA", index: 2, items: [] } }))).toEqual({ container: "IDEA", index: 2 });
  });

  it("is unknown over a column or nothing", () => {
    expect(landingOf(over({}))).toBeNull();
    expect(landingOf(null)).toBeNull();
  });
});
