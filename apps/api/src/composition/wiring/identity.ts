import { config } from "#shared/infrastructure/config.js";
import { LogMailTransport, SmtpMailTransport } from "#shared/infrastructure/mail.js";
import { prisma } from "#shared/infrastructure/prisma.js";
import { createIdentityUseCases, type InvitationRedemption } from "#modules/identity/index.js";
import { PasswordAdapter } from "#modules/identity/infrastructure/password-adapter.js";
import {
  PrismaPasswordResetRepository,
  PrismaRefreshSessionRepository,
  PrismaUserRepository,
} from "#modules/identity/infrastructure/prisma-identity-repositories.js";
import { ProfileStorageAdapter } from "#modules/identity/infrastructure/profile-storage-adapter.js";
import { ResetLinkMailer } from "#modules/identity/infrastructure/reset-link-mailer.js";
import { TokenAdapter } from "#modules/identity/infrastructure/token-adapter.js";
import { createAuthentication } from "#modules/identity/presentation/http/authentication.js";
import { createIdentityHttpRouters } from "#modules/identity/presentation/http/identity-http.js";
import type { Kernel } from "./kernel.js";

export function wireIdentity(
  { unitOfWork, clock }: Kernel,
  { redeem, signedOut }: { redeem: InvitationRedemption["redeem"]; signedOut: (userId: string) => void },
) {
  const mail = config.mail
    ? new SmtpMailTransport(config.mail)
    : config.production ? null : new LogMailTransport();
  const identity = createIdentityUseCases({
    users: new PrismaUserRepository(prisma, unitOfWork),
    invitations: { redeem },
    passwords: new PasswordAdapter(),
    tokens: new TokenAdapter(),
    sessions: new PrismaRefreshSessionRepository(prisma, unitOfWork),
    resets: new PrismaPasswordResetRepository(prisma, unitOfWork),
    resetLinks: new ResetLinkMailer(mail, config.appUrl),
    profiles: new ProfileStorageAdapter(),
    clock,
    unitOfWork,
  });
  const { authRouter, userRouter } = createIdentityHttpRouters(identity, { signedOut });
  return {
    authRouter,
    userRouter,
    authentication: createAuthentication(identity),
    authenticate: (accessToken: string) => identity.authenticate(accessToken),
  };
}
