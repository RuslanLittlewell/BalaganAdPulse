import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { hookWrapper, server } from "@test/shared/index.js";
import { useClients } from "@/entities/client/index.js";

it("reuses a fresh client list across mounts and refreshes after explicit invalidation", async () => {
  let reads = 0;
  server.use(http.get("/api/clients", () => { reads++; return HttpResponse.json([]); }));
  const wrapper = hookWrapper();
  const first = renderHook(() => useClients(), { wrapper });
  await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
  first.unmount();
  const second = renderHook(() => useClients(), { wrapper });
  expect(second.result.current.isFetching).toBe(false);
  expect(reads).toBe(1);
  await act(async () => { await wrapper.client.invalidateQueries({ queryKey: ["clients"] }); });
  expect(reads).toBe(2);
  second.unmount();
  wrapper.client.clear();
});
