import { act, renderHook } from "@testing-library/react";
import { useDragPreview } from "@/shared/lib/index.js";

interface Card { id: string; column: string }

const before: Card[] = [{ id: "a", column: "IDEA" }, { id: "b", column: "IDEA" }];
const moved: Card[] = [{ id: "a", column: "DONE" }, { id: "b", column: "IDEA" }];
const toDone = (cards: Card[]) => cards.map((card) => card.id === "a" ? { ...card, column: "DONE" } : card);

function setup(items: Card[] | undefined = before) {
  return renderHook(({ items: current }) => useDragPreview(current), { initialProps: { items } });
}

describe("the board shown around a drag", () => {
  it("shows the items while nothing is dragged", () => {
    const { result } = setup();
    expect(result.current.board).toBe(before);
    expect(result.current.draggingId).toBeNull();
  });

  it("shows the preview while a card is dragged", () => {
    const { result } = setup();
    act(() => result.current.start("a"));
    act(() => result.current.preview(toDone));

    expect(result.current.draggingId).toBe("a");
    expect(result.current.board).toEqual(moved);
  });

  it("keeps the dropped placement until the items catch up, so the card never flies back", () => {
    const { result } = setup();
    act(() => result.current.start("a"));
    act(() => result.current.preview(toDone));
    act(() => result.current.settle());

    expect(result.current.draggingId).toBeNull();
    expect(result.current.board).toEqual(moved);
  });

  it("hands the board back to the items once they change", () => {
    const { result, rerender } = setup();
    act(() => result.current.start("a"));
    act(() => result.current.preview(toDone));
    act(() => result.current.settle());

    const confirmed = [...moved];
    rerender({ items: confirmed });

    expect(result.current.board).toBe(confirmed);
  });

  it("shows a rolled-back move as rolled back, not as the stale preview", () => {
    const { result, rerender } = setup();
    act(() => result.current.start("a"));
    act(() => result.current.preview(toDone));
    act(() => result.current.settle());

    rerender({ items: [...moved] });
    rerender({ items: before });

    expect(result.current.board).toBe(before);
  });

  it("holds the drop even when the items changed while the card was in the air", () => {
    const { result, rerender } = setup();
    act(() => result.current.start("a"));
    act(() => result.current.preview(toDone));
    const refreshed = [...before];
    rerender({ items: refreshed });
    act(() => result.current.settle());

    expect(result.current.board).toEqual(moved);
  });

  it("shows the items at once when a drag is cancelled", () => {
    const { result } = setup();
    act(() => result.current.start("a"));
    act(() => result.current.preview(toDone));
    act(() => result.current.cancel());

    expect(result.current.draggingId).toBeNull();
    expect(result.current.board).toBe(before);
  });

  it("releases a dropped placement once the move is settled", () => {
    const { result } = setup();
    act(() => result.current.start("a"));
    act(() => result.current.preview(toDone));
    act(() => result.current.settle());
    act(() => result.current.release());

    expect(result.current.board).toBe(before);
  });

  it("does not let an earlier move's settling disturb the next drag", () => {
    const { result } = setup();
    act(() => result.current.start("a"));
    act(() => result.current.preview(toDone));
    act(() => result.current.settle());
    act(() => result.current.start("b"));
    act(() => result.current.preview(toDone));
    act(() => result.current.release());

    expect(result.current.draggingId).toBe("b");
    expect(result.current.board).toEqual(moved);
  });
});
