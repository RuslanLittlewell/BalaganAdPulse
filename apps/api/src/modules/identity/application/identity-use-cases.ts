import { AppError } from "#shared/domain/index.js";
import type { TransactionContext } from "#shared/application/index.js";
import { principalOf } from "../domain/identity-user.js";
import type { ClientRegistration, IdentityDependencies } from "./ports.js";

export interface RegisterIdentityInput {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly phone?: string | null;
  readonly telegram?: string | null;
  readonly inviteCode: string;
  readonly registration?: ClientRegistration;
}

export interface LoginIdentityInput {
  readonly email: string;
  readonly password: string;
}

export interface UpdateIdentityProfileInput {
  readonly name: string;
  readonly phone?: string | null;
  readonly telegram?: string | null;
  readonly currentPassword?: string;
  readonly newPassword?: string;
}

export function createIdentityUseCases(dependencies: IdentityDependencies) {
  const issueTokenPair = async (context: TransactionContext, user: Parameters<typeof principalOf>[0]) => {
    const refreshToken = dependencies.tokens.generateRefresh();
    await dependencies.sessions.save(context, {
      userId: user.id,
      tokenHash: dependencies.tokens.hashRefresh(refreshToken),
      expiresAt: dependencies.tokens.refreshExpiry(dependencies.clock.now()),
    });
    return {
      accessToken: await dependencies.tokens.issueAccess(principalOf(user)),
      refreshToken,
    };
  };

  return {
    authenticate: async (accessToken: string) => {
      try {
        return await dependencies.tokens.verifyAccess(accessToken);
      } catch {
        throw new AppError("unauthorized", "Authentication required");
      }
    },

    register: async (input: RegisterIdentityInput) => {
      const passwordHash = await dependencies.passwords.hash(input.password);
      return dependencies.unitOfWork.run(async (context) => {
        const user = await dependencies.users.create(context, {
          name: input.name,
          email: input.email,
          passwordHash,
          phone: input.phone ?? null,
          telegram: input.telegram ?? null,
        });
        await dependencies.invitations.redeem(
          context, input.inviteCode, input.email, user.id, dependencies.clock.now(),
          input.registration,
        );
        return issueTokenPair(context, user);
      });
    },

    login: async (input: LoginIdentityInput) => {
      const user = await dependencies.users.findByEmail(input.email);
      const matches = await dependencies.passwords.verify(input.password, user?.passwordHash ?? dependencies.passwords.dummyHash);
      if (!user || !matches) throw new AppError("unauthorized", "Invalid email or password");
      return dependencies.unitOfWork.run((context) => issueTokenPair(context, user));
    },

    refresh: async (refreshToken: string) => {
      const session = await dependencies.sessions.find(dependencies.tokens.hashRefresh(refreshToken));
      if (!session || session.expiresAt <= dependencies.clock.now()) {
        throw new AppError("unauthorized", "Session expired");
      }
      return { accessToken: await dependencies.tokens.issueAccess(principalOf(session.user)) };
    },

    logout: async (refreshToken: string): Promise<string | null> => {
      const tokenHash = dependencies.tokens.hashRefresh(refreshToken);
      const session = await dependencies.sessions.find(tokenHash);
      await dependencies.unitOfWork.run((context) =>
        dependencies.sessions.revoke(context, tokenHash));
      return session?.user.id ?? null;
    },

    principal: async (userId: string) => {
      const user = await dependencies.users.findById(userId);
      if (!user) throw new AppError("unauthorized", "Authentication required");
      return principalOf(user);
    },

    profile: async (userId: string) => {
      const user = await dependencies.users.findById(userId);
      if (!user) throw new AppError("not-found", "User not found");
      const image = user.image ? await dependencies.profiles.readAvatar(userId) : null;
      return {
        name: user.name,
        email: user.email,
        image,
        avatarPath: user.avatarPath,
        phone: user.phone,
        telegram: user.telegram,
      };
    },

    updateProfile: async (userId: string, input: UpdateIdentityProfileInput) => {
      const user = await dependencies.users.findById(userId);
      if (!user) throw new AppError("not-found", "User not found");
      let passwordHash: string | undefined;
      if (input.newPassword) {
        if (!await dependencies.passwords.verify(input.currentPassword ?? "", user.passwordHash)) {
          throw new AppError("forbidden", "Current password is incorrect");
        }
        passwordHash = await dependencies.passwords.hash(input.newPassword);
      }
      return dependencies.unitOfWork.run(async (context) => {
        const updated = await dependencies.users.update(context, userId, {
          name: input.name,
          ...(input.phone === undefined ? {} : { phone: input.phone }),
          ...(input.telegram === undefined ? {} : { telegram: input.telegram }),
          ...(passwordHash ? { passwordHash } : {}),
        });
        return { accessToken: await dependencies.tokens.issueAccess(principalOf(updated)) };
      });
    },
    saveAvatar: async (userId: string, png: Uint8Array, avatarPath: string) => {
      await dependencies.profiles.writeAvatar(userId, png);
      await dependencies.unitOfWork.run((context) => dependencies.users.setAvatar(context, userId, {
        image: dependencies.clock.now().toISOString(), avatarPath,
      }));
    },
  };
}

export type IdentityUseCases = ReturnType<typeof createIdentityUseCases>;
