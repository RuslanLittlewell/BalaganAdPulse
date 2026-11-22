import { config } from "#shared/infrastructure/config.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import { createIdentityUseCases, type InvitationRedemption, type SecondFactorGate } from "#modules/identity/index.js";
import { PasswordAdapter } from "#modules/identity/infrastructure/password-adapter.js";
import {
  PrismaPasswordResetRepository,
  PrismaRefreshSessionRepository,
  PrismaUserRepository,
} from "#modules/identity/infrastructure/prisma-identity-repositories.js";
import { PrismaSignInLocks } from "#modules/identity/infrastructure/prisma-sign-in-locks.js";
import { ProfileStorageAdapter } from "#modules/identity/infrastructure/profile-storage-adapter.js";
import { ResetLinkMailer } from "#modules/identity/infrastructure/reset-link-mailer.js";
import { TokenAdapter } from "#modules/identity/infrastructure/token-adapter.js";
import { createAuthentication } from "#modules/identity/presentation/http/authentication.js";
import { createIdentityHttpRouters } from "#modules/identity/presentation/http/identity-http.js";
import type { Kernel } from "./kernel.js";

export function wireIdentity(
  { unitOfWork, clock, mail }: Kernel,
  { redeem, signedOut, secondFactor }: {
    redeem: InvitationRedemption["redeem"];
    signedOut: (userId: string) => void;
    secondFactor: SecondFactorGate;
  },
) {
  const identity = createIdentityUseCases({
    users: new PrismaUserRepository(prisma, unitOfWork),
    invitations: { redeem },
    passwords: new PasswordAdapter(),
    tokens: new TokenAdapter(),
    sessions: new PrismaRefreshSessionRepository(prisma, unitOfWork),
    resets: new PrismaPasswordResetRepository(prisma, unitOfWork),
    locks: new PrismaSignInLocks(prisma, unitOfWork),
    secondFactor,
    resetLinks: new ResetLinkMailer(mail, config.appUrl),
    profiles: new ProfileStorageAdapter(),
    clock,
    unitOfWork,
  });
  const { authRouter, userRouter } = createIdentityHttpRouters(identity, { signedOut });
  return {
    authRouter,
    userRouter,
    authentication: createAuthentication(identity, config.appUrl ? new URL(config.appUrl).origin : null),
    authenticate: (accessToken: string) => identity.authenticate(accessToken),
    openAccount: identity.openAccount,
    sessions: { completeSecondFactor: identity.completeSecondFactor, endSessions: identity.endSessions },
  };
}
