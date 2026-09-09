import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { asArrangement, type ProjectLayout } from "../model/layout.js";
import { projectLayoutApi } from "./layout.js";

const LAYOUT_KEY = ["project-layout"] as const;

export function useProjectLayout() {
  return useQuery({ queryKey: LAYOUT_KEY, queryFn: projectLayoutApi.read });
}

export function useSaveProjectLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: ProjectLayout) => projectLayoutApi.save(asArrangement(layout)),
    onMutate: async (layout: ProjectLayout) => {
      await qc.cancelQueries({ queryKey: LAYOUT_KEY });
      const previous = qc.getQueryData<ProjectLayout>(LAYOUT_KEY);
      qc.setQueryData(LAYOUT_KEY, layout);
      return { previous };
    },
    onError: (_error, _layout, context) => {
      qc.setQueryData(LAYOUT_KEY, context?.previous);
    },
    onSuccess: (layout) => { qc.setQueryData(LAYOUT_KEY, layout); },
  });
}

export function useCreateProjectGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => projectLayoutApi.createGroup(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: LAYOUT_KEY }),
  });
}

export function useDeleteProjectGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => projectLayoutApi.removeGroup(groupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: LAYOUT_KEY }),
  });
}
