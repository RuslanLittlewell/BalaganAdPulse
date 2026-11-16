import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/lib/index.js";

export interface WebsiteKey {
  key: string;
  allowedSites: string[];
  createdAt: string;
  rotatedAt: string | null;
}

const keyPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/website-key`;
const keyId = (projectId: string) => ["website-key", projectId] as const;

export function useWebsiteKey(projectId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keyId(projectId),
    queryFn: ({ signal }) => http.get<WebsiteKey | null>(keyPath(projectId), { signal }),
    enabled,
  });
}

export function useWebsiteKeyChange(projectId: string) {
  const client = useQueryClient();
  const store = (key: WebsiteKey | null) => client.setQueryData(keyId(projectId), key);
  return {
    create: useMutation({ mutationFn: () => http.put<WebsiteKey>(keyPath(projectId), {}), onSuccess: store }),
    rotate: useMutation({ mutationFn: () => http.post<WebsiteKey>(`${keyPath(projectId)}/rotate`, {}), onSuccess: store }),
    allow: useMutation({ mutationFn: (sites: string[]) => http.put<WebsiteKey>(`${keyPath(projectId)}/sites`, { sites }), onSuccess: store }),
    remove: useMutation({ mutationFn: () => http.del(keyPath(projectId)), onSuccess: () => store(null) }),
  };
}
