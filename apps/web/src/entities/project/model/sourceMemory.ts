import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SourceMemoryState {
  sources: Record<string, string>;
  rememberSource: (projectId: string, source: string) => void;
}

export const useSourceMemory = create<SourceMemoryState>()(
  persist(
    (set) => ({
      sources: {},
      rememberSource: (projectId, source) =>
        set((state) =>
          state.sources[projectId] === source
            ? state
            : { sources: { ...state.sources, [projectId]: source } },
        ),
    }),
    { name: "adpulse-project-sources", version: 1 },
  ),
);
