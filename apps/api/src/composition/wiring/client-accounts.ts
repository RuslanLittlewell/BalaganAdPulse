import { prisma } from "#shared/infrastructure/prisma.js";
import { createClientAccountRouter, createClientAccountUseCases } from "#modules/client-accounts/index.js";
import { AesPasswordCipher } from "#modules/client-accounts/infrastructure/aes-password-cipher.js";
import { CryptoCredentialGenerator } from "#modules/client-accounts/infrastructure/crypto-credential-generator.js";
import { PrismaClientAccountRepository } from "#modules/client-accounts/infrastructure/prisma-client-account-repository.js";
import { PasswordAdapter } from "#modules/identity/infrastructure/password-adapter.js";
import { PrismaInvitationProjectAccess, PrismaMembershipEnrolment } from "#modules/members/index.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";

export function wireClientAccounts(
  { unitOfWork, ids, audit }: Kernel,
  { clientRepository }: Pick<ClientsAndProjects, "clientRepository">,
) {
  const clientAccounts = createClientAccountUseCases({
    accounts: new PrismaClientAccountRepository(prisma, unitOfWork),
    clients: { findReachable: (actor, clientId) => clientRepository.findReachable(actor, clientId) },
    memberships: new PrismaMembershipEnrolment(unitOfWork),
    access: new PrismaInvitationProjectAccess(unitOfWork),
    credentials: new CryptoCredentialGenerator(),
    passwords: new PasswordAdapter(),
    cipher: new AesPasswordCipher(process.env.INTEGRATION_ENCRYPTION_KEY),
    audit,
    ids,
    unitOfWork,
  });
  return { clientAccountRouter: createClientAccountRouter(clientAccounts) };
}
