import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { hookWrapper, server } from "@test/shared/index.js";
import { seoSitesKey, useSeoAudit, useSeoAuditPages, useSeoSearch, useSeoSites } from "@/entities/seo/index.js";

const site = {
  id: "s1", siteUrl: "sc-domain:site.ru", label: "site.ru", status: "RUNNING",
  lastSuccessAt: null, lastError: null, checkStatus: "RUNNING", lastCheckAt: null, checkError: null,
};

it("refreshes open search figures and page checks when their jobs finish", async () => {
  let searchReads = 0;
  let auditReads = 0;
  let pageReads = 0;
  server.use(
    http.get("/api/projects/p1/seo/sites", () => HttpResponse.json([site])),
    http.get("/api/projects/p1/seo/sites/s1/search", () => HttpResponse.json({
      from: "2026-11-01", to: "2026-11-07", latestDay: "2026-11-05",
      totals: { clicks: ++searchReads, impressions: 10, ctr: 0.1, position: 2 },
      previous: { clicks: 0, impressions: 0, ctr: null, position: null }, days: [],
    })),
    http.get("/api/projects/p1/seo/sites/s1/audit", () => HttpResponse.json({
      status: "SUCCESS", lastCheckAt: null, checkError: null, result: { finishedAt: "2026-11-07T08:00:00Z", checked: ++auditReads, notChecked: 0, pagesWithErrors: 0, pagesWithWarnings: 0, kinds: [] },
    })),
    http.get("/api/projects/p1/seo/sites/s1/audit/pages", () => HttpResponse.json([{ id: String(++pageReads), url: "https://site.ru/", status: 200, outcome: "FETCHED", problems: [] }])),
  );

  const wrapper = hookWrapper();
  const range = { from: "2026-11-01", to: "2026-11-07" };
  const { result } = renderHook(() => ({
    sites: useSeoSites("p1"),
    search: useSeoSearch("p1", "s1", range),
    audit: useSeoAudit("p1", "s1"),
    pages: useSeoAuditPages("p1", "s1", "ALL"),
  }), { wrapper });

  await waitFor(() => expect(result.current.sites.data).toHaveLength(1));
  await waitFor(() => expect([searchReads, auditReads, pageReads]).toEqual([1, 1, 1]));

  act(() => {
    wrapper.client.setQueryData(seoSitesKey("p1"), [{
      ...site, status: "SUCCESS", checkStatus: "SUCCESS",
      lastSuccessAt: "2026-11-07T09:00:00Z", lastCheckAt: "2026-11-07T09:00:00Z",
    }]);
  });

  await waitFor(() => expect([searchReads, auditReads, pageReads]).toEqual([2, 2, 2]));
  expect(result.current.search.data?.totals.clicks).toBe(2);
  expect(result.current.audit.data?.result?.checked).toBe(2);
  expect(result.current.pages.data?.[0]?.id).toBe("2");
});
