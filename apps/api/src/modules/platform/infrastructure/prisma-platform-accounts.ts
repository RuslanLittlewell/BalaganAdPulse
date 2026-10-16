import type { PrismaClient } from "@prisma/client";
import type { PlatformAdministrators, RegisteredAccounts } from "../application/ports.js";

export class PrismaPlatformAccounts implements PlatformAdministrators, RegisteredAccounts {
  constructor(private readonly prisma: PrismaClient) {}

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    return user?.isPlatformAdmin ?? false;
  }

  async isRegistered(email: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { email } })) > 0;
  }
}
