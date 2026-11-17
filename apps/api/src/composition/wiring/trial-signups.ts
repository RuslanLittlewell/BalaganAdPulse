import { prisma } from "#shared/infrastructure/prisma.js";
import { config } from "#shared/infrastructure/config.js";
import type { TransactionContext } from "#shared/application/index.js";
import { PasswordAdapter } from "#modules/identity/infrastructure/password-adapter.js";
import { PrismaMembershipEnrolment } from "#modules/members/infrastructure/prisma-membership-enrolment.js";
import { PrismaPlatformAccounts } from "#modules/platform/infrastructure/prisma-platform-accounts.js";
import { createTrialSignupRouter, createTrialSignupUseCases } from "#modules/trial-signups/index.js";
import { PrismaTrialSignupRepository } from "#modules/trial-signups/infrastructure/prisma-trial-signups.js";
import { TrialLinkMailer } from "#modules/trial-signups/infrastructure/trial-link-mailer.js";
import { TrialTokenAdapter } from "#modules/trial-signups/infrastructure/trial-token-adapter.js";
import type { Kernel } from "./kernel.js";

interface TrialSeams {
  readonly openAccount: (
    context: TransactionContext,
    input: { name: string; email: string; passwordHash: string },
  ) => Promise<{ userId: string; tokens: { accessToken: string; refreshToken: string } }>;
  readonly openTrialOrganization: (context: TransactionContext, name: string) => Promise<string>;
}

export function wireTrialSignups({ unitOfWork, clock, ids, mail }: Kernel, seams: TrialSeams) {
  const enrolment = new PrismaMembershipEnrolment(unitOfWork);
  const useCases = createTrialSignupUseCases({
    signups: new PrismaTrialSignupRepository(prisma, unitOfWork),
    emails: new PrismaPlatformAccounts(prisma),
    tokens: new TrialTokenAdapter(),
    passwords: { hash: (plain) => new PasswordAdapter().hash(plain) },
    links: new TrialLinkMailer(mail, config.appUrl),
    provisioning: {
      provision: async (context, { organizationName, name, email, passwordHash }) => {
        const orgId = await seams.openTrialOrganization(context, organizationName);
        const { userId, tokens } = await seams.openAccount(context, { name, email, passwordHash });
        await enrolment.enrol(context, { userId, orgId, role: "ADMIN" });
        return tokens;
      },
    },
    ids,
    clock,
    unitOfWork,
  });
  return { trialSignupRouter: createTrialSignupRouter(useCases) };
}
