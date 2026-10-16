import { moduleKeyFromPathname } from "@/shared/lib/routes.js";

describe("moduleKeyFromPathname", () => {
  it("maps the root path to the dashboard module", () => {
    expect(moduleKeyFromPathname("/")).toBe("dashboard");
  });

  it("maps a top-level path to its module", () => {
    expect(moduleKeyFromPathname("/crm")).toBe("crm");
    expect(moduleKeyFromPathname("/tasks")).toBe("tasks");
    expect(moduleKeyFromPathname("/reports")).toBe("reports");
    expect(moduleKeyFromPathname("/archive")).toBe("archive");
  });

  it("maps a nested path to its containing module", () => {
    expect(moduleKeyFromPathname("/projects")).toBe("projects");
    expect(moduleKeyFromPathname("/projects/client-1")).toBe("projects");
    expect(moduleKeyFromPathname("/projects/client-1/campaigns/campaign-1")).toBe("projects");
  });
});
