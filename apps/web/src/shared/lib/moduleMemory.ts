import { create } from "zustand";
import { persist } from "zustand/middleware";

type ByUser = Record<string, string>;

interface ModuleMemoryState {
  boards: ByUser;
  projectPlaces: ByUser;
  taskViews: ByUser;
  crmViews: ByUser;
  rememberBoard: (userId: string, board: string) => void;
  forgetBoard: (userId: string) => void;
  rememberProjectPlace: (userId: string, place: string) => void;
  forgetProjectPlace: (userId: string) => void;
  rememberTaskView: (userId: string, view: string) => void;
  rememberCrmView: (userId: string, view: string) => void;
}

function withValue(map: ByUser, userId: string, value: string): ByUser {
  return map[userId] === value ? map : { ...map, [userId]: value };
}

function withoutUser(map: ByUser, userId: string): ByUser {
  if (!(userId in map)) return map;
  const { [userId]: _forgotten, ...rest } = map;
  return rest;
}

export const useModuleMemory = create<ModuleMemoryState>()(
  persist(
    (set) => ({
      boards: {},
      projectPlaces: {},
      taskViews: {},
      crmViews: {},
      rememberBoard: (userId, board) =>
        set((state) => ({ boards: withValue(state.boards, userId, board) })),
      forgetBoard: (userId) =>
        set((state) => ({ boards: withoutUser(state.boards, userId) })),
      rememberProjectPlace: (userId, place) =>
        set((state) => ({
          projectPlaces: withValue(state.projectPlaces, userId, place),
        })),
      forgetProjectPlace: (userId) =>
        set((state) => ({
          projectPlaces: withoutUser(state.projectPlaces, userId),
        })),
      rememberTaskView: (userId, view) =>
        set((state) => ({
          taskViews: withValue(state.taskViews, userId, view),
        })),
      rememberCrmView: (userId, view) =>
        set((state) => ({
          crmViews: withValue(state.crmViews, userId, view),
        })),
    }),
    {
      name: "adpulse-module-memory",
      version: 1,
      partialize: (state) => ({
        boards: state.boards,
        projectPlaces: state.projectPlaces,
        taskViews: state.taskViews,
        crmViews: state.crmViews,
      }),
    },
  ),
);
