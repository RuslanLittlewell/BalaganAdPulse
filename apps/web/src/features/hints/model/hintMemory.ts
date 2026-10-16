import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuth } from "@/features/auth/index.js";

export const HINTS = {
  contactsFirstPeople: "contacts.firstPeople",
  contactsFirstClient: "contacts.firstClient",
  projectsFirstProject: "projects.firstProject",
  projectsFirstClient: "projects.firstClient",
} as const;

export type HintId = (typeof HINTS)[keyof typeof HINTS];

interface HintMemoryState {
  dismissed: Record<string, string[]>;
  dismiss: (userId: string, hint: HintId) => void;
}

export const useHintMemory = create<HintMemoryState>()(
  persist(
    (set) => ({
      dismissed: {},
      dismiss: (userId, hint) =>
        set((state) => {
          const seen = state.dismissed[userId] ?? [];
          if (seen.includes(hint)) return state;
          return { dismissed: { ...state.dismissed, [userId]: [...seen, hint] } };
        }),
    }),
    {
      name: "adpulse-hints",
      version: 1,
      partialize: (state) => ({ dismissed: state.dismissed }),
    },
  ),
);

export function useHint(hint: HintId, applies: boolean) {
  const { user } = useAuth();
  const dismissed = useHintMemory((state) =>
    user != null && (state.dismissed[user.id] ?? []).includes(hint));
  const dismiss = useHintMemory((state) => state.dismiss);
  return {
    open: user != null && applies && !dismissed,
    dismiss: () => { if (user) dismiss(user.id, hint); },
  };
}
