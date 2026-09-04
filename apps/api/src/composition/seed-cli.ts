import { prisma } from "#shared/infrastructure/prisma.js";
import { hashPassword } from "../modules/identity/infrastructure/password-adapter.js";

const MIN_PASSWORD_LENGTH = 8;

export interface SeedEnv {
  SEED_ADMIN_NAME?: string;
  SEED_ADMIN_EMAIL?: string;
  SEED_ADMIN_PASSWORD?: string;
  ORG_NAME?: string;
}

export interface SeedResult {
  created: boolean;
  message: string;
}

function required(env: SeedEnv, key: keyof SeedEnv): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is required but not set`);
  return value;
}

export async function seedFirstAdmin(env: SeedEnv = process.env): Promise<SeedResult> {
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    throw new Error("No organization found; run the migrations before seeding");
  }

  const existingAdmin = await prisma.membership.findFirst({
    where: { orgId: organization.id, role: "ADMIN", status: "ACTIVE" },
  });
  if (existingAdmin) {
    return { created: false, message: "An active admin already exists; nothing to do" };
  }

  const email = required(env, "SEED_ADMIN_EMAIL").trim().toLowerCase();
  const password = required(env, "SEED_ADMIN_PASSWORD");
  const name = env.SEED_ADMIN_NAME?.trim() || "Admin";
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  await prisma.$transaction(async (tx) => {
    if (env.ORG_NAME) {
      await tx.organization.update({
        where: { id: organization.id },
        data: { name: env.ORG_NAME },
      });
    }
    const user =
      (await tx.user.findUnique({ where: { email } })) ??
      (await tx.user.create({
        data: { name, email, passwordHash: await hashPassword(password) },
      }));

    await tx.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: organization.id } },
      create: { userId: user.id, orgId: organization.id, role: "ADMIN", status: "ACTIVE" },
      update: { role: "ADMIN", status: "ACTIVE" },
    });
  });

  return { created: true, message: `Seeded ${email} as an admin` };
}

const isEntrypoint =
  process.argv[1]?.endsWith("seed-cli.ts") || process.argv[1]?.endsWith("seed-cli.js");
if (isEntrypoint) {
  await import("dotenv/config");
  seedFirstAdmin()
    .then(async (result) => {
      console.log(result.message);
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}
