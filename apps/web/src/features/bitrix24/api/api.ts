import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/lib/index.js";

export interface Bitrix24Connection {
  portalHost: string;
  status: "ACTIVE" | "AUTH_REQUIRED";
  enabled: boolean;
  inboundProjectId: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  webhookUrl: string;
}

export interface Bitrix24Status {
  id: string;
  name: string;
}

export interface Bitrix24Stage {
  key: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
  statusId: string | null;
}

export interface Bitrix24Problem {
  kind: string;
  key: string;
  reason: string;
  label: string | null;
  createdAt: string;
}

export interface Bitrix24Run {
  id: string;
  direction: "UPLOAD" | "DOWNLOAD";
  state: "RUNNING" | "DONE" | "FAILED";
  created: number;
  linked: number;
  failed: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface Bitrix24Change {
  webhookUrl?: string;
  applicationToken?: string;
  enabled?: boolean;
  inboundProjectId?: string | null;
}

const ROOT = ["bitrix24"] as const;
const POLL_MS = 10_000;

export function useBitrix24Connection({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...ROOT, "connection"],
    queryFn: ({ signal }) => http.get<Bitrix24Connection | null>("/bitrix24/connection", { signal }),
    enabled,
    refetchInterval: POLL_MS,
  });
}

export function useBitrix24Details(connected: boolean) {
  return {
    statuses: useQuery({
      queryKey: [...ROOT, "statuses"],
      queryFn: ({ signal }) => http.get<Bitrix24Status[]>("/bitrix24/statuses", { signal }),
      enabled: connected,
      staleTime: 60_000,
    }),
    stages: useQuery({
      queryKey: [...ROOT, "stages"],
      queryFn: ({ signal }) => http.get<Bitrix24Stage[]>("/bitrix24/stages", { signal }),
      enabled: connected,
    }),
    problems: useQuery({
      queryKey: [...ROOT, "problems"],
      queryFn: ({ signal }) => http.get<Bitrix24Problem[]>("/bitrix24/problems", { signal }),
      enabled: connected,
      refetchInterval: POLL_MS,
    }),
    run: useQuery({
      queryKey: [...ROOT, "run"],
      queryFn: ({ signal }) => http.get<Bitrix24Run | null>("/bitrix24/runs/latest", { signal }),
      enabled: connected,
      refetchInterval: POLL_MS,
    }),
  };
}

export function useBitrix24Changes() {
  const client = useQueryClient();
  const storeConnection = (connection: Bitrix24Connection | null) => client.setQueryData([...ROOT, "connection"], connection);
  const refresh = () => client.invalidateQueries({ queryKey: ROOT });
  return {
    connect: useMutation({
      mutationFn: (body: { webhookUrl: string; applicationToken: string }) => http.post<Bitrix24Connection>("/bitrix24/connection", body),
      onSuccess: (connection) => { storeConnection(connection); void refresh(); },
    }),
    change: useMutation({
      mutationFn: (body: Bitrix24Change) => http.patch<Bitrix24Connection>("/bitrix24/connection", body),
      onSuccess: (connection) => { storeConnection(connection); void client.invalidateQueries({ queryKey: [...ROOT, "problems"] }); },
    }),
    remove: useMutation({
      mutationFn: () => http.del("/bitrix24/connection"),
      onSuccess: () => { storeConnection(null); },
    }),
    saveStages: useMutation({
      mutationFn: (links: Array<{ stageKey: string; statusId: string | null }>) => http.put<Bitrix24Stage[]>("/bitrix24/stages", { links }),
      onSuccess: (stages) => { client.setQueryData([...ROOT, "stages"], stages); void client.invalidateQueries({ queryKey: [...ROOT, "problems"] }); },
    }),
    startRun: useMutation({
      mutationFn: (direction: Bitrix24Run["direction"]) => http.post<Bitrix24Run>("/bitrix24/runs", { direction }),
      onSuccess: (run) => { client.setQueryData([...ROOT, "run"], run); },
    }),
  };
}
