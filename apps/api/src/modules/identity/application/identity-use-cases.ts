import { AppError } from "#shared/domain/index.js";
import type { TransactionContext } from "#shared/application/index.js";
import { principalOf } from "../domain/identity-user.js";
import {
  FAILURES_PER_ROUND,
  PASSWORD_RESET_REQUIRED,
  SIGN_IN_LOCKED,
  lockDurationMs,
  signInLockKey,
  unknownLoginKey,
  type SignInLockState,
} from "../domain/sign-in-lock.js";
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
  readonly login: string;
  readonly password: string;
}

export interface UpdateIdentityProfileInput {
  readonly name: string;
  readonly phone?: string | null;
  readonly telegram?: string | null;
  readonly currentPassword?: string;
  readonly newPassword?: string;
}

export type SignInResult =
  | { readonly kind: "session"; readonly tokens: { accessToken: string; refreshToken: string } }
  | { readonly kind: "challenge"; readonly challenge: string; readonly expiresAt: Date };

export const INVALID_SECOND_FACTOR = "The code is not valid";

export const SIGN_IN_LOCKED_MESSAGE = "Too many failed sign-in attempts; sign-in is locked for a while";
export const PASSWORD_RESET_REQUIRED_MESSAGE = "Too many failed sign-in attempts; reset the password to sign in";

export function createIdentityUseCases(dependencies: IdentityDependencies) {
  const refuseLocked = (state: SignInLockState | null, now: Date): never => {
    if (state?.resetRequired) {
      throw new AppError("forbidden", PASSWORD_RESET_REQUIRED_MESSAGE, [{ code: PASSWORD_RESET_REQUIRED }]);
    }
    const until = state?.lockedUntil && state.lockedUntil > now
      ? state.lockedUntil
      : new Date(now.getTime() + lockDurationMs(state?.round ?? 0));
    throw new AppError("forbidden", SIGN_IN_LOCKED_MESSAGE, [{ code: SIGN_IN_LOCKED, until: until.toISOString() }]);
  };

  const issueTokenPair = async (
    context: TransactionContext,
    user: Parameters<typeof principalOf>[0],
  ) => {
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

  const usableReset = async (token: string) => {
    const tokenHash = dependencies.tokens.hashReset(token);
    const reset = await dependencies.resets.find(tokenHash);
    if (!reset || reset.expiresAt <= dependencies.clock.now()) {
      throw new AppError(
        "not-found",
        "This password reset link is invalid or has expired",
      );
    }
    return { ...reset, tokenHash };
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
          context,
          input.inviteCode,
          input.email,
          user.id,
          dependencies.clock.now(),
          input.registration,
        );
        return issueTokenPair(context, user);
      });
    },

    openAccount: async (
      context: TransactionContext,
      input: { name: string; email: string; passwordHash: string },
    ) => {
      const user = await dependencies.users.create(context, input);
      return { userId: user.id, tokens: await issueTokenPair(context, user) };
    },

    login: async (input: LoginIdentityInput, address: string): Promise<SignInResult> => {
      const user = (await dependencies.users.findByLogin(input.login))
        ?? (await dependencies.users.findByEmail(input.login));
      const key = user ? signInLockKey(user.id) : unknownLoginKey(input.login);
      const now = dependencies.clock.now();
      const attempt = await dependencies.locks.reserve(key, now, FAILURES_PER_ROUND);
      if (!attempt.allowed) refuseLocked(attempt.state, now);
      const matches = await dependencies.passwords.verify(
        input.password,
        user?.passwordHash ?? dependencies.passwords.dummyHash,
      );
      if (!user || !matches) {
        if (attempt.allowed && attempt.failures >= FAILURES_PER_ROUND) {
          refuseLocked(await dependencies.locks.lock(key, now), now);
        }
        throw new AppError("unauthorized", "Invalid login or password");
      }
      if (await dependencies.secondFactor.needed(user.id, address)) {
        await dependencies.locks.release(key);
        return { kind: "challenge", ...(await dependencies.secondFactor.open(user.id)) };
      }
      await dependencies.locks.clear(key);
      return {
        kind: "session",
        tokens: await dependencies.unitOfWork.run((context) => issueTokenPair(context, user)),
      };
    },

    completeSecondFactor: async (userId: string, verify: () => Promise<boolean>) => {
      const key = signInLockKey(userId);
      const now = dependencies.clock.now();
      const attempt = await dependencies.locks.reserve(key, now, FAILURES_PER_ROUND);
      if (!attempt.allowed) refuseLocked(attempt.state, now);
      if (!(await verify())) {
        if (attempt.allowed && attempt.failures >= FAILURES_PER_ROUND) {
          refuseLocked(await dependencies.locks.lock(key, now), now);
        }
        throw new AppError("unauthorized", INVALID_SECOND_FACTOR, [{ code: "INVALID_CODE" }]);
      }
      await dependencies.locks.clear(key);
      const user = await dependencies.users.findById(userId);
      if (!user) throw new AppError("unauthorized", "Authentication required");
      return dependencies.unitOfWork.run((context) => issueTokenPair(context, user));
    },

    endSessions: async (userId: string) => {
      await dependencies.unitOfWork.run((context) => dependencies.sessions.revokeAll(context, userId));
    },

    requestPasswordReset: async (email: string) => {
      if (!dependencies.resetLinks.available) {
        throw new AppError("unavailable", "Password recovery is not available");
      }
      const user = await dependencies.users.findByEmail(email);
      if (!user?.email) return;
      const token = dependencies.tokens.generateReset();
      await dependencies.unitOfWork.run((context) =>
        dependencies.resets.replace(context, {
          userId: user.id,
          tokenHash: dependencies.tokens.hashReset(token),
          expiresAt: dependencies.tokens.resetExpiry(dependencies.clock.now()),
        }),
      );
      dependencies.resetLinks.deliver(
        { email: user.email, name: user.name },
        token,
      );
    },

    checkPasswordReset: async (token: string) => {
      await usableReset(token);
    },

    resetPassword: async (token: string, password: string, address: string): Promise<SignInResult> => {
      const reset = await usableReset(token);
      const passwordHash = await dependencies.passwords.hash(password);
      const user = await dependencies.unitOfWork.run(async (context) => {
        if (!(await dependencies.resets.consume(context, reset.tokenHash))) {
          throw new AppError(
            "not-found",
            "This password reset link is invalid or has expired",
          );
        }
        const user = await dependencies.users.setPassword(
          context,
          reset.userId,
          passwordHash,
        );
        await dependencies.sessions.revokeAll(context, user.id);
        await dependencies.locks.clear(signInLockKey(user.id), context);
        return user;
      });
      if (await dependencies.secondFactor.needed(user.id, address)) {
        return { kind: "challenge", ...(await dependencies.secondFactor.open(user.id)) };
      }
      return {
        kind: "session",
        tokens: await dependencies.unitOfWork.run((context) => issueTokenPair(context, user)),
      };
    },

    refresh: async (refreshToken: string) => {
      const session = await dependencies.sessions.find(
        dependencies.tokens.hashRefresh(refreshToken),
      );
      if (!session || session.expiresAt <= dependencies.clock.now()) {
        throw new AppError("unauthorized", "Session expired");
      }
      return {
        accessToken: await dependencies.tokens.issueAccess(
          principalOf(session.user),
        ),
      };
    },

    logout: async (refreshToken: string): Promise<string | null> => {
      const tokenHash = dependencies.tokens.hashRefresh(refreshToken);
      const session = await dependencies.sessions.find(tokenHash);
      await dependencies.unitOfWork.run((context) =>
        dependencies.sessions.revoke(context, tokenHash),
      );
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
      const image = user.image
        ? await dependencies.profiles.readAvatar(userId)
        : null;
      return {
        name: user.name,
        email: user.email,
        login: user.login,
        image,
        avatarPath: user.avatarPath,
        phone: user.phone,
        telegram: user.telegram,
      };
    },

    updateProfile: async (
      userId: string,
      input: UpdateIdentityProfileInput,
    ) => {
      const user = await dependencies.users.findById(userId);
      if (!user) throw new AppError("not-found", "User not found");
      let passwordHash: string | undefined;
      if (input.newPassword) {
        if (
          !(await dependencies.passwords.verify(
            input.currentPassword ?? "",
            user.passwordHash,
          ))
        ) {
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
        if (passwordHash) {
          await dependencies.sessions.revokeAll(context, userId);
          await dependencies.locks.clear(signInLockKey(userId), context);
          return issueTokenPair(context, updated);
        }
        return {
          accessToken: await dependencies.tokens.issueAccess(
            principalOf(updated),
          ),
        };
      });
    },
    saveAvatar: async (userId: string, png: Uint8Array, avatarPath: string) => {
      await dependencies.profiles.writeAvatar(userId, png);
      await dependencies.unitOfWork.run((context) =>
        dependencies.users.setAvatar(context, userId, {
          image: dependencies.clock.now().toISOString(),
          avatarPath,
        }),
      );
    },
  };
}

export type IdentityUseCases = ReturnType<typeof createIdentityUseCases>;
