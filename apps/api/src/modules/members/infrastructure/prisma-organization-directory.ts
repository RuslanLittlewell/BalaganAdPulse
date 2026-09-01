import type { PrismaClient } from "@prisma/client";
import type { OrganizationDirectory } from "../application/ports.js";

export class PrismaOrganizationDirectory implements OrganizationDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  findById(orgId: string) {
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true },
    });
  }
}
