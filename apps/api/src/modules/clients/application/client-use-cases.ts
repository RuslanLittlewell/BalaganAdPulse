import { can } from "@adpulse/access-policy";
import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import type { ClientContact, ClientRecord, NewClient } from "../domain/client.js";
import type { ClientDependencies } from "./ports.js";

const VERB = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted" } as const;

function entitySummary(action: keyof typeof VERB, name: string): string {
  return `${VERB[action]} client “${name}”`;
}

export function createClientUseCases(dependencies: ClientDependencies) {
  const assertCan = (actor: ActorContext, action: "create" | "update" | "delete") => {
    if (!can(actor, action, "client")) {
      throw new AppError("forbidden", `Your role may not ${action} a client`);
    }
  };

  const reach = async (actor: ActorContext, id: string): Promise<ClientRecord> => {
    const client = await dependencies.clients.findReachable(actor, id);
    if (!client) throw new AppError("not-found", "Client not found");
    return client;
  };

  const withPicture = async (client: ClientRecord): Promise<ClientRecord> => {
    if (!client.image) return client;
    const bytes = await dependencies.pictures.read(client.id);
    if (!bytes) return { ...client, image: null };
    return { ...client, image: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}` };
  };

  return {
    create: async (actor: ActorContext, input: NewClient): Promise<ClientRecord> => {
      assertCan(actor, "create");
      return dependencies.unitOfWork.run(async (context) => {
        const client = await dependencies.clients.create(
          context,
          { ...input, id: dependencies.ids.generate(), orgId: actor.orgId },
          actor.role === "ADMIN" ? undefined : actor.membershipId,
        );
        await dependencies.audit.append(context, {
          action: "CREATE", entityType: "client", entityId: client.id, clientId: client.id,
          summary: entitySummary("CREATE", client.name),
        }, actor);
        return client;
      });
    },

    list: async (actor: ActorContext): Promise<ClientRecord[]> => {
      const clients = await dependencies.clients.listReachable(actor);
      return Promise.all(clients.map(withPicture));
    },

    read: async (actor: ActorContext, id: string): Promise<ClientRecord> =>
      withPicture(await reach(actor, id)),

    update: async (actor: ActorContext, id: string, input: ClientContact): Promise<ClientRecord> => {
      await reach(actor, id);
      assertCan(actor, "update");
      const updated = await dependencies.unitOfWork.run(async (context) => {
        const client = await dependencies.clients.update(context, id, input);
        await dependencies.audit.append(context, {
          action: "UPDATE", entityType: "client", entityId: id, clientId: id,
          summary: entitySummary("UPDATE", client.name),
        }, actor);
        return client;
      });
      return withPicture(updated);
    },

    delete: async (actor: ActorContext, id: string): Promise<void> => {
      const client = await reach(actor, id);
      assertCan(actor, "delete");
      await dependencies.unitOfWork.run(async (context) => {
        await dependencies.clients.delete(context, id);
        await dependencies.audit.append(context, {
          action: "DELETE", entityType: "client", entityId: id, clientId: id,
          summary: entitySummary("DELETE", client.name),
        }, actor);
      });
    },

    savePicture: async (
      actor: ActorContext,
      id: string,
      png: Uint8Array,
      avatarPath: string,
    ): Promise<ClientRecord> => {
      const client = await reach(actor, id);
      assertCan(actor, "update");
      await dependencies.pictures.write(id, png);
      const updated = await dependencies.unitOfWork.run(async (context) => {
        const saved = await dependencies.clients.update(context, id, {
          image: new Date().toISOString(), avatarPath,
        } as ClientContact);
        await dependencies.audit.append(context, {
          action: "UPDATE", entityType: "client", entityId: id, clientId: id,
          summary: `Updated picture for client “${client.name}”`,
        }, actor);
        return saved;
      });
      return withPicture(updated);
    },

    reachableIds: (actor: ActorContext): Promise<string[]> =>
      dependencies.clients.reachableIds(actor),
  };
}

export type ClientUseCases = ReturnType<typeof createClientUseCases>;
