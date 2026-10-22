import { useSearchParams } from "react-router-dom";

export const PREVIEW_PARAM = "preview";

export interface PreviewMode {
  previewing: boolean;
  enter: () => void;
  leave: () => void;
}

export function usePreviewMode(): PreviewMode {
  const [params, setParams] = useSearchParams();
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
