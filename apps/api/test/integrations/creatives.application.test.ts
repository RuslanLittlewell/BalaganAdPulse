import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../../src/shared/application/index.js";
import { createIntegrationUseCases } from "../../src/modules/integrations/application/integration-use-cases.js";
import type { IntegrationDependencies } from "../../src/modules/integrations/application/ports.js";
import type { CreativeView } from "../../src/modules/integrations/domain/snapshot.js";

const actor: ActorContext = {
  userId: "u1", membershipId: "m1", orgId: "o1", role: "ADMIN",
};

const storedCreative: CreativeView = {
  id: "cr1", position: 0, kind: "IMAGE", title: "Banner", body: null,
  hasFile: true, hasPoster: false,
};

function fixture(initial: CreativeView[] = [], connected = true) {
  let stored = initial;
  let release: (() => void) | undefined;
  const provider = vi.fn(async () => {
    await new Promise<void>((resolve) => { release = resolve; });
    return [{
      adExternalId: "meta-ad", creativeId: "meta-creative", position: 0,
      kind: "IMAGE" as const, fileUrl: "https://cdn.invalid/banner.jpg",
    }];
  });
  const save = vi.fn(async () => {
    stored = [storedCreative];
    return stored;
  });
  const dependencies = {
    ads: { locate: vi.fn(async () => ({ projectId: "p1", externalId: "meta-ad" })) },
    creatives: { list: vi.fn(async () => stored), save },
    repository: { read: vi.fn(async () => connected ? ({ accountId: "account", encryptedToken: "cipher" }) : null) },
    cipher: { decrypt: vi.fn(() => "token") },
    provider: { adCreatives: provider },
    files: { copy: vi.fn(async () => ({ key: "creatives/key", contentType: "image/jpeg", bytes: 42 })) },
    projects: {}, clock: {}, unitOfWork: {}, audit: {},
  } as unknown as IntegrationDependencies;
  return {
    service: createIntegrationUseCases(dependencies), provider, save,
    release: () => release?.(), dependencies,
  };
}

describe("creative loading", () => {
  it("fetches and stores one ad's creatives on first view", async () => {
    const d = fixture();
    const result = d.service.adCreatives(actor, "a1");
    await vi.waitFor(() => expect(d.provider).toHaveBeenCalledOnce());
    d.release();

    await expect(result).resolves.toEqual([storedCreative]);
    expect(d.provider).toHaveBeenCalledWith("meta-ad", "token", "account");
    expect(d.save).toHaveBeenCalledOnce();
  });

  it("returns stored creatives without asking the provider", async () => {
    const d = fixture([storedCreative]);

    await expect(d.service.adCreatives(actor, "a1")).resolves.toEqual([storedCreative]);
    expect(d.provider).not.toHaveBeenCalled();
  });

  it("returns an empty stored result when the project has no connection", async () => {
    const d = fixture([], false);

    await expect(d.service.adCreatives(actor, "a1")).resolves.toEqual([]);
    expect(d.provider).not.toHaveBeenCalled();
  });

  it("coalesces simultaneous first views of the same ad", async () => {
    const d = fixture();
    const first = d.service.adCreatives(actor, "a1");
    const second = d.service.adCreatives(actor, "a1");
    await vi.waitFor(() => expect(d.provider).toHaveBeenCalled());
    d.release();

    await expect(Promise.all([first, second])).resolves.toEqual([
      [storedCreative], [storedCreative],
    ]);
    expect(d.provider).toHaveBeenCalledOnce();
    expect(d.save).toHaveBeenCalledOnce();
  });
});
