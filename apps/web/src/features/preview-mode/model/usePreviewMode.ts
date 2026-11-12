import { useSearchParams } from "react-router-dom";
import { useShareScope } from "@/shared/lib/index.js";

export const PREVIEW_PARAM = "preview";

export interface PreviewMode {
  previewing: boolean;
  enter: () => void;
  leave: () => void;
}

const SHARED_PREVIEW: PreviewMode = { previewing: true, enter: () => {}, leave: () => {} };

export function usePreviewMode(): PreviewMode {
  const [params, setParams] = useSearchParams();
  const shared = useShareScope();
  if (shared) return SHARED_PREVIEW;
  return {
    previewing: params.get(PREVIEW_PARAM) === "1",
    enter: () => setParams((current) => {
      const next = new URLSearchParams(current);
      next.set(PREVIEW_PARAM, "1");
      return next;
    }),
    leave: () => setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete(PREVIEW_PARAM);
      return next;
    }, { replace: true }),
  };
}
