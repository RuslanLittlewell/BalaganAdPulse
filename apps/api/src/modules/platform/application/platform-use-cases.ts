import { enabledModules, type OptionalModule } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { SessionPrincipal } from "#modules/identity/index.js";
import { InvitationCodeConflictError } from "#modules/invites/index.js";
import {
  firstAdminState,
  slugBase,
  uniqueSlug,
  type OrganizationRecord,
} from "../domain/organization.js";
import type { OrganizationChange, PlatformDependencies } from "./ports.js";

const MAX_CODE_ATTEMPTS = 5;

export interface CreateOrganizationInput {
  readonly name: string;
  readonly modules: readonly OptionalModule[];
  readonly adminEmail: string;
}

const registrationUrlFor = (code: string) => `/regustration/${code}`;

export function createPlatformUseCases(dependencies: PlatformDependencies) {
  const view = (record: OrganizationRecord) => {
    const invitation = record.firstAdminInvitation;
    const state = invitation && firstAdminState(invitation, dependencies.clock.now());
    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      status: record.status,
      modules: enabledModules(record.modules),
      activeMembers: record.activeMembers,
      createdAt: record.createdAt,
      firstAdmin: invitation && state
        ? {
            email: invitation.email,
            state,
            registrationUrl: state === "PENDING" ? registrationUrlFor(invitation.code) : null,
          }
        : null,
    };
  };

  const existing = async (id: string) => {
    const record = await dependencies.organizations.findById(id);
    if (!record) throw new AppError("not-found", "Organization not found");
    return record;
  };

  return {
    assertPlatformAdmin: async (principal: SessionPrincipal): Promise<void> => {
      if (!(await dependencies.administrators.isPlatformAdmin(principal.id))) {
        throw new AppError("forbidden", "Only the platform administrator may do this");
      }
    },

    list: async () => (await dependencies.organizations.list()).map(view),

    create: async (input: CreateOrganizationInput) => {
      if (await dependencies.accounts.isRegistered(input.adminEmail)) {
        throw new AppError("conflict", "This email is already registered");
      }
      const base = slugBase(input.name);
      const slug = uniqueSlug(base, await dependencies.organizations.slugsStartingWith(base));
      const id = dependencies.ids.generate();
      const modules = [...new Set(input.modules)];
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
        try {
          const { code } = await dependencies.unitOfWork.run(async (context) => {
            await dependencies.organizations.create(context, { id, name: input.name, slug, modules });
            return dependencies.invitations.issue(context, { orgId: id, email: input.adminEmail });
          });
          return { organization: view(await existing(id)), registrationUrl: registrationUrlFor(code) };
        } catch (error) {
          if (!(error instanceof InvitationCodeConflictError)) throw error;
        }
      }
      throw new Error("Unable to generate a unique invitation code");
    },

    update: async (id: string, change: OrganizationChange) => {
      await existing(id);
      const modules = change.modules && [...new Set(change.modules)];
      await dependencies.unitOfWork.run((context) =>
        dependencies.organizations.update(context, id, { ...change, modules }),
      );
      return view(await existing(id));
    },

    delete: async (id: string): Promise<void> => {
      await existing(id);
      await dependencies.unitOfWork.run((context) => dependencies.organizations.delete(context, id));
    },
  };
}

export type PlatformUseCases = ReturnType<typeof createPlatformUseCases>;
