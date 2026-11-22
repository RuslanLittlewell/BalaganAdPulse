import { prisma } from "#shared/infrastructure/prisma.js";
import {
  createOrganizationTwoFactorRouter,
  createPlatformTwoFactorRouter,
  createTwoFactorGate,
  createTwoFactorRouter,
  createTwoFactorSignInRouter,
  createTwoFactorUseCases,
  type SessionIssuer,
} from "#modules/two-factor/index.js";
import { PrismaTwoFactorStore } from "#modules/two-factor/infrastructure/prisma-two-factor-store.js";
import { SvgQrRenderer } from "#modules/two-factor/infrastructure/qr-renderer.js";
import { TotpAdapter } from "#modules/two-factor/infrastructure/totp-adapter.js";
import { AesTwoFactorSecrets } from "#modules/two-factor/infrastructure/two-factor-secrets.js";
import { PrismaPlatformAccounts } from "#modules/platform/infrastructure/prisma-platform-accounts.js";
import type { Kernel } from "./kernel.js";

export function wireTwoFactor({ clock, unitOfWork, audit }: Kernel, sessions: SessionIssuer) {
  const useCases = createTwoFactorUseCases({
    store: new PrismaTwoFactorStore(prisma),
    totp: new TotpAdapter(),
    qr: new SvgQrRenderer(),
    secrets: new AesTwoFactorSecrets(process.env.INTEGRATION_ENCRYPTION_KEY),
    sessions,
    platform: new PrismaPlatformAccounts(prisma),
    audit: {
      record: (context, change, actor) => audit.append(context, {
        action: "UPDATE",
        entityType: "member",
        entityId: change.membershipId,
        summary: `Reset the second factor of ${change.name}`,
        changes: { twoFactor: "reset" },
      }, actor),
    },
    clock,
    unitOfWork,
  });
  return {
    gate: { needed: useCases.needed, open: useCases.open },
    twoFactorRouter: createTwoFactorRouter(useCases),
    twoFactorSignInRouter: createTwoFactorSignInRouter(useCases),
    organizationTwoFactorRouter: createOrganizationTwoFactorRouter(useCases),
    platformTwoFactorRouter: createPlatformTwoFactorRouter(useCases),
    twoFactorGate: createTwoFactorGate(useCases),
  };
}
