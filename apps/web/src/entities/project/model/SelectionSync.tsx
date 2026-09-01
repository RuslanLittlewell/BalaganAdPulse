import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { parseSelection, useSelectionStore } from "./selection.js";

/**
 * Feeds the address into the selection store on every navigation — including
 * the ones the browser makes on its own, which is how back and forward keep
 * working. In a layout effect, so the store is right before anything paints.
 */
export function SelectionSync() {
  const { pathname } = useLocation();
  const select = useSelectionStore((state) => state.select);

  useLayoutEffect(() => {
    select(parseSelection(pathname));
  }, [pathname, select]);

  return null;
}
