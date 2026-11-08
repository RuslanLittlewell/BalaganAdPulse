import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  for (const queryKey of [["clients"], ["project-layout"], ["summary-tiles"], ["user", "profile"], ["crm", "fields"]]) {
    client.setQueryDefaults(queryKey, { staleTime: 5 * 60_000 });
  }
  client.setQueryDefaults(["organization"], { staleTime: 60_000 });
  client.setQueryDefaults(["crm", "boards"], { staleTime: 30_000 });
  return client;
}
