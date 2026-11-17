import { AppError } from "#shared/domain/index.js";
import type { TrialSignupDependencies } from "./ports.js";

export interface RequestTrialInput {
  readonly organizationName: string;
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

const DEAD_LINK = "This trial confirmation link is invalid or has expired";

export function createTrialSignupUseCases(dependencies: TrialSignupDependencies) {
  const usable = async (token: string) => {
    const tokenHash = dependencies.tokens.hash(token);
    const signup = await dependencies.signups.find(tokenHash);
    if (!signup || signup.expiresAt <= dependencies.clock.now()) throw new AppError("not-found", DEAD_LINK);
    return signup;
  };

  return {
    request: async (input: RequestTrialInput): Promise<void> => {
      if (!dependencies.links.available) throw new AppError("unavailable", "Trial signup is not available");
      if (await dependencies.emails.isRegistered(input.email)) return;
      const token = dependencies.tokens.generate();
      const passwordHash = await dependencies.passwords.hash(input.password);
      await dependencies.unitOfWork.run((context) =>
        dependencies.signups.replace(context, {
          id: dependencies.ids.generate(),
          email: input.email,
          organizationName: input.organizationName,
          name: input.name,
          passwordHash,
          tokenHash: dependencies.tokens.hash(token),
          expiresAt: dependencies.tokens.expiry(dependencies.clock.now()),
        }),
      );
      dependencies.links.deliver(
        { email: input.email, name: input.name, organizationName: input.organizationName },
        token,
      );
    },

    check: async (token: string): Promise<void> => {
      await usable(token);
    },

    confirm: async (token: string) => {
      const signup = await usable(token);
      if (await dependencies.emails.isRegistered(signup.email)) throw new AppError("not-found", DEAD_LINK);
      return dependencies.unitOfWork.run(async (context) => {
        if (!(await dependencies.signups.consume(context, signup.tokenHash))) {
          throw new AppError("not-found", DEAD_LINK);
        }
        return dependencies.provisioning.provision(context, {
          organizationName: signup.organizationName,
          name: signup.name,
          email: signup.email,
          passwordHash: signup.passwordHash,
        });
      });
    },
  };
}

export type TrialSignupUseCases = ReturnType<typeof createTrialSignupUseCases>;
