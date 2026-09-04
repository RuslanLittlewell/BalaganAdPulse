import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { parseSelection, useSelectionStore } from "./selection.js";

export function SelectionSync() {
  const { pathname } = useLocation();
  const select = useSelectionStore((state) => state.select);

  useLayoutEffect(() => {
    select(parseSelection(pathname));
  }, [pathname, select]);

  return null;
}
