import { describe, expect, it } from "vitest";
import { AppError } from "../../src/shared/domain/app-error.js";
import type { ActorContext } from "../../src/shared/application/index.js";
import { createMemberUseCases } from "../../src/modules/members/index.js";

const PRINCIPAL = { id: "u1", name: "Buyer", email: "buyer@acme.com" };
const ACTOR: ActorContext = { userId: "u1", membershipId: "m1", orgId: "org1", role: "MANAGER" };

function fixture(actor: ActorContext | null) {
  const asked: string[] = [];
  const useCases = createMemberUseCases({
    memberships: {
      findActiveByUserId: async (userId) => { asked.push(userId); return actor; },
    },
  });
  return { asked, useCases };
}

describe("resolveActor", () => {
  it("resolves the active membership into an ActorContext", async () => {
    const { useCases } = fixture(ACTOR);
    await expect(useCases.resolveActor(PRINCIPAL)).resolves.toEqual(ACTOR);
  });

  it("looks the membership up by the principal's user id", async () => {
    const { asked, useCases } = fixture(ACTOR);
    await useCases.resolveActor(PRINCIPAL);
    expect(asked).toEqual(["u1"]);
  });

  it("refuses a principal with no active membership", async () => {
    const { useCases } = fixture(null);
    await expect(useCases.resolveActor(PRINCIPAL)).rejects.toBeInstanceOf(AppError);
    await expect(useCases.resolveActor(PRINCIPAL)).rejects.toMatchObject({ category: "forbidden" });
  });

  it("asks the directory again for every resolution", async () => {
    const { asked, useCases } = fixture(ACTOR);
    await useCases.resolveActor(PRINCIPAL);
    await useCases.resolveActor(PRINCIPAL);
    expect(asked).toEqual(["u1", "u1"]);
  });
});
