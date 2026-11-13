import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/lib/index.js";

export type DatasetState = "ACTIVE" | "AUTH_REQUIRED";
export type SendStatus = "WAITING_AMOUNT" | "PENDING" | "SENT" | "FAILED" | "EXPIRED";

export interface Dataset {
  datasetId: string;
  datasetName: string;
  testEventCode: string | null;
  currency: string;
  state: DatasetState;
  lastError: string | null;
  lastSentAt: string | null;
}

export interface RecentSend {
  id: string;
  leadId: string;
  leadName: string;
  eventName: string;
  reachedAt: string;
  status: SendStatus;
  lastError: string | null;
  sentAt: string | null;
}

export interface ConversionsSummary {
  dataset: Dataset | null;
  counts: { today: number; week: number; month: number };
  recent: RecentSend[];
}

export interface DatasetSettings {
  datasetId: string;
  token?: string;
  testEventCode: string | null;
  currency?: string;
}

export interface ConversionEvent {
  id: string;
  projectId: string;
  name: string;
  stages: string[];
  carriesAmount: boolean;
}

export interface ConversionEventInput {
  name: string;
  stages: string[];
  carriesAmount: boolean;
}

export const CONVERSION_EVENT_LIMIT = 10;
export const CONVERSION_EVENT_NAME_LIMIT = 50;

const summaryPath = (projectId: string) => `/projects/${projectId}/conversions-api`;
const eventsPath = (projectId: string) => `/crm/boards/${projectId}/conversion-events`;
export const conversionsKey = (projectId: string) => ["conversions-api", projectId] as const;
export const conversionEventsKey = (projectId: string) => ["conversion-events", projectId] as const;

export function useConversionsSummary(projectId: string) {
  return useQuery({
    queryKey: conversionsKey(projectId),
    queryFn: ({ signal }) => http.get<ConversionsSummary>(summaryPath(projectId), { signal }),
    refetchInterval: 30_000,
  });
}

export function useSaveDataset(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: DatasetSettings) => http.put<ConversionsSummary>(summaryPath(projectId), settings),
    onSuccess: (summary) => queryClient.setQueryData(conversionsKey(projectId), summary),
  });
}

export function useDisconnectDataset(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http.del(summaryPath(projectId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversionsKey(projectId) }),
  });
}

export function useConversionEvents(projectId: string, enabled = true) {
  return useQuery({
    queryKey: conversionEventsKey(projectId),
    queryFn: ({ signal }) => http.get<ConversionEvent[]>(eventsPath(projectId), { signal }),
    enabled,
  });
}

export function useCreateConversionEvent(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConversionEventInput) => http.post<ConversionEvent>(eventsPath(projectId), input),
    onSuccess: (created) => queryClient.setQueryData<ConversionEvent[]>(conversionEventsKey(projectId), (list) => [...(list ?? []), created]),
  });
}

export function useUpdateConversionEvent(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ConversionEventInput & { id: string }) => http.patch<ConversionEvent>(`${eventsPath(projectId)}/${id}`, input),
    onSuccess: (saved) => queryClient.setQueryData<ConversionEvent[]>(conversionEventsKey(projectId), (list) =>
      list?.map((event) => (event.id === saved.id ? saved : event))),
  });
}

export function useDeleteConversionEvent(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.del(`${eventsPath(projectId)}/${id}`),
    onSuccess: (_result, id) => queryClient.setQueryData<ConversionEvent[]>(conversionEventsKey(projectId), (list) =>
      list?.filter((event) => event.id !== id)),
  });
}
