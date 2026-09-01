import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import type { Expression } from "../domain/expression.js";
import { assertFormulaIsValid, findDependents, type PropertyType } from "../domain/property.js";
import { computeTable, type ComputedTable } from "../domain/table.js";
import type {
  CampaignDependencies,
  CampaignRecord,
  PropertyRecord,
} from "./ports.js";

const VERB = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted" } as const;

export interface CreatePropertyInput {
  readonly name: string;
  readonly type: PropertyType;
  readonly position?: number;
  readonly formula?: Expression | null;
}

export interface UpdatePropertyInput {
  readonly name?: string;
  readonly type?: PropertyType;
  readonly position?: number;
  readonly formula?: Expression | null;
}

export interface CampaignTable extends ComputedTable {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly position: number;
  readonly properties: readonly PropertyRecord[];
}

export function createCampaignUseCases(dependencies: CampaignDependencies) {
  const assertCan = (
    actor: ActorContext,
    action: "create" | "update" | "delete",
    resource: "campaign" | "property",
  ) => {
    if (!can(actor, action, resource)) {
      throw new AppError("forbidden", `Your role may not ${action} a ${resource}`);
    }
  };

  const reachCampaign = async (actor: ActorContext, id: string): Promise<CampaignRecord> => {
    const campaign = await dependencies.campaigns.findReachable(actor, id);
    if (!campaign) throw new AppError("not-found", "Campaign not found");
    return campaign;
  };

  const reachProject = async (actor: ActorContext, projectId: string) => {
    const project = await dependencies.projects.contextFor(actor, projectId);
    if (!project) throw new AppError("not-found", "Project not found");
    return project;
  };

  const reachProperty = async (actor: ActorContext, id: string): Promise<PropertyRecord> => {
    const property = await dependencies.properties.findReachable(actor, id);
    if (!property) throw new AppError("not-found", "Property not found");
    return property;
  };

  return {
    create: async (actor: ActorContext, projectId: string, input: { name: string }) => {
      const project = await reachProject(actor, projectId);
      assertCan(actor, "create", "campaign");
      return dependencies.unitOfWork.run(async (context) => {
        const campaign = await dependencies.campaigns.create(context, {
          id: dependencies.ids.generate(),
          projectId,
          name: input.name,
          position: await dependencies.campaigns.countForProject(projectId),
        });
        await dependencies.audit.append(context, {
          action: "CREATE", entityType: "campaign", entityId: campaign.id,
          clientId: project.clientId, projectId, campaignId: campaign.id,
          summary: `${VERB.CREATE} campaign “${campaign.name}”`,
        }, actor);
        return campaign;
      });
    },

    list: async (actor: ActorContext, projectId: string) => {
      await reachProject(actor, projectId);
      return dependencies.campaigns.listForProject(projectId);
    },

    read: (actor: ActorContext, id: string) => reachCampaign(actor, id),

    readTable: async (actor: ActorContext, id: string): Promise<CampaignTable> => {
      const data = await dependencies.campaigns.readTable(actor, id);
      if (!data) throw new AppError("not-found", "Campaign not found");
      const { records, totals } = computeTable(data.properties, data.records);
      return {
        id: data.campaign.id,
        projectId: data.campaign.projectId,
        name: data.campaign.name,
        position: data.campaign.position,
        properties: data.properties,
        records,
        totals,
      };
    },

    update: async (
      actor: ActorContext,
      id: string,
      input: { name?: string; position?: number },
    ) => {
      const campaign = await reachCampaign(actor, id);
      assertCan(actor, "update", "campaign");
      const context = await dependencies.auditContext.forCampaign(id);
      await dependencies.unitOfWork.run(async (transaction) => {
        if (input.name !== undefined) {
          await dependencies.campaigns.rename(transaction, id, input.name);
        }
        if (input.position !== undefined) {
          await dependencies.campaigns.renumber(transaction, campaign.projectId, id, input.position);
        }
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "campaign", entityId: id, ...context,
          summary: `${VERB.UPDATE} campaign “${input.name ?? campaign.name}”`,
        }, actor);
      });
      return reachCampaign(actor, id);
    },

    delete: async (actor: ActorContext, id: string) => {
      const campaign = await reachCampaign(actor, id);
      assertCan(actor, "delete", "campaign");
      const context = await dependencies.auditContext.forCampaign(id);
      await dependencies.unitOfWork.run(async (transaction) => {
        await dependencies.campaigns.delete(transaction, id);
        await dependencies.campaigns.renumber(transaction, campaign.projectId);
        await dependencies.audit.append(transaction, {
          action: "DELETE", entityType: "campaign", entityId: id, ...context,
          summary: `${VERB.DELETE} campaign “${campaign.name}”`,
        }, actor);
      });
    },

    createProperty: async (
      actor: ActorContext,
      campaignId: string,
      input: CreatePropertyInput,
    ): Promise<PropertyRecord> => {
      const campaign = await dependencies.campaigns.findReachable(actor, campaignId);
      assertCan(actor, "create", "property");
      if (!campaign) throw new AppError("not-found", "Campaign not found");

      const existing = await dependencies.properties.siblings(campaignId);
      const id = dependencies.ids.generate();
      const formula = input.formula ?? null;
      if (formula) {
        if (input.type === "TEXT") {
          throw new AppError("validation", "A text property cannot have a formula");
        }
        assertFormulaIsValid(id, formula, existing);
      }

      const position = Math.max(0, Math.min(input.position ?? existing.length, existing.length));
      const auditContext = await dependencies.auditContext.forCampaign(campaignId);
      return dependencies.unitOfWork.run(async (transaction) => {
        await dependencies.properties.shiftFrom(transaction, campaignId, position);
        const property = await dependencies.properties.create(transaction, {
          // Only the seeded columns carry a key; one added by hand has none.
          id, campaignId, key: null, name: input.name, type: input.type, position, formula,
        });
        await dependencies.audit.append(transaction, {
          action: "CREATE", entityType: "property", entityId: id, ...auditContext,
          summary: `${VERB.CREATE} column “${property.name}”`,
        }, actor);
        return property;
      });
    },

    updateProperty: async (
      actor: ActorContext,
      id: string,
      input: UpdatePropertyInput,
    ): Promise<PropertyRecord> => {
      const property = await reachProperty(actor, id);
      assertCan(actor, "update", "property");
      const existing = await dependencies.properties.siblings(property.campaignId);
      const nextType = input.type ?? property.type;

      if (input.type !== undefined && input.type !== property.type) {
        const crossesTextBoundary = (input.type === "TEXT") !== (property.type === "TEXT");
        if (crossesTextBoundary && (await dependencies.properties.countValues(id)) > 0) {
          throw new AppError(
            "conflict",
            "Property has entered values; clear them before changing its type",
          );
        }
      }

      if (input.formula !== undefined && input.formula !== null) {
        if (nextType === "TEXT") {
          throw new AppError("validation", "A text property cannot have a formula");
        }
        if ((await dependencies.properties.countValues(id)) > 0) {
          throw new AppError(
            "conflict",
            "Property has entered values; clear them before adding a formula",
          );
        }
        assertFormulaIsValid(id, input.formula, existing);
      }
      // `formula: null` turns a computed property back into an entered one —
      // always allowed.

      const nextFormula = input.formula !== undefined ? input.formula : property.formula;
      if (nextType === "TEXT" && nextFormula !== null) {
        throw new AppError("validation", "A text property cannot have a formula");
      }

      const data: { name?: string; type?: PropertyType; formula?: Expression | null } = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.type !== undefined) data.type = input.type;
      if (input.formula !== undefined) data.formula = input.formula;

      const auditContext = await dependencies.auditContext.forCampaign(property.campaignId);
      await dependencies.unitOfWork.run(async (transaction) => {
        if (Object.keys(data).length > 0) {
          await dependencies.properties.update(transaction, id, data);
        }
        if (input.position !== undefined) {
          await dependencies.properties.renumber(transaction, property.campaignId, id, input.position);
        }
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "property", entityId: id, ...auditContext,
          summary: `${VERB.UPDATE} column “${input.name ?? property.name}”`,
        }, actor);
      });
      return reachProperty(actor, id);
    },

    deleteProperty: async (actor: ActorContext, id: string): Promise<void> => {
      const property = await reachProperty(actor, id);
      assertCan(actor, "delete", "property");
      const existing = await dependencies.properties.siblings(property.campaignId);
      const dependents = findDependents(id, existing);
      if (dependents.length > 0) {
        const names = existing
          .filter((sibling) => dependents.some((dependent) => dependent.id === sibling.id))
          .map((sibling) => sibling.name)
          .join(", ");
        throw new AppError("conflict", `Property is used by the formula of: ${names}`);
      }
      const auditContext = await dependencies.auditContext.forCampaign(property.campaignId);
      await dependencies.unitOfWork.run(async (transaction) => {
        await dependencies.properties.delete(transaction, id);
        await dependencies.properties.renumber(transaction, property.campaignId);
        await dependencies.audit.append(transaction, {
          action: "DELETE", entityType: "property", entityId: id, ...auditContext,
          summary: `${VERB.DELETE} column “${property.name}”`,
        }, actor);
      });
    },
  };
}

export type CampaignUseCases = ReturnType<typeof createCampaignUseCases>;
