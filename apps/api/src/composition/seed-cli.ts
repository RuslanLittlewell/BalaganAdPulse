import { prisma } from "#shared/infrastructure/prisma.js";
import { hashPassword } from "#modules/identity/infrastructure/password-adapter.js";

const MIN_PASSWORD_LENGTH = 8;

export interface SeedEnv {
  SEED_ADMIN_NAME?: string;
  SEED_ADMIN_EMAIL?: string;
  SEED_ADMIN_PASSWORD?: string;
  ORG_NAME?: string;
  SEED_PLATFORM_ADMIN_EMAIL?: string;
  SEED_PLATFORM_ADMIN_PASSWORD?: string;
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

function strongEnough(password: string, key: keyof SeedEnv): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${key} must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return password;
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
  const password = strongEnough(required(env, "SEED_ADMIN_PASSWORD"), "SEED_ADMIN_PASSWORD");
  const name = env.SEED_ADMIN_NAME?.trim() || "Admin";

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

export async function seedPlatformAdmin(env: SeedEnv = process.env): Promise<SeedResult> {
  const existing = await prisma.user.findFirst({ where: { isPlatformAdmin: true } });
  if (existing) {
    return { created: false, message: "A platform administrator already exists; nothing to do" };
  }

  const email = required(env, "SEED_PLATFORM_ADMIN_EMAIL").trim().toLowerCase();
  const password = strongEnough(
    required(env, "SEED_PLATFORM_ADMIN_PASSWORD"), "SEED_PLATFORM_ADMIN_PASSWORD",
  );

  const account = await prisma.user.findUnique({
    where: { email },
    select: { id: true, _count: { select: { memberships: true } } },
  });
  if (account && account._count.memberships > 0) {
    throw new Error(`${email} belongs to an organization and cannot administer the platform`);
  }
  if (account) {
    await prisma.user.update({ where: { id: account.id }, data: { isPlatformAdmin: true } });
    return { created: true, message: `Made ${email} the platform administrator` };
  }

  await prisma.user.create({
    data: {
      name: "Platform administrator",
      email,
      passwordHash: await hashPassword(password),
      isPlatformAdmin: true,
    },
  });
  return { created: true, message: `Seeded ${email} as the platform administrator` };
}

const SEEDS: Record<string, (env?: SeedEnv) => Promise<SeedResult>> = {
  admin: seedFirstAdmin,
  platform: seedPlatformAdmin,
};

const isEntrypoint =
  process.argv[1]?.endsWith("seed-cli.ts") || process.argv[1]?.endsWith("seed-cli.js");
if (isEntrypoint) {
  await import("dotenv/config");
  const seed = SEEDS[process.argv[2] ?? "admin"];
  if (!seed) throw new Error(`Unknown seed ${process.argv[2]}; expected one of ${Object.keys(SEEDS).join(", ")}`);
  seed()
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
