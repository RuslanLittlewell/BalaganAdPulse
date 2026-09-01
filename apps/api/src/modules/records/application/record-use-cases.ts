import { can } from "@adpulse/access-policy";
import { AppError } from "../../../shared/domain/index.js";
import type { ActorContext } from "../../../shared/application/index.js";
import type { JsonValue } from "../../audit/index.js";
import type { ComputedRecord } from "../../campaigns/index.js";
import {
  describeChanges,
  normalizeValue,
  parseDay,
  validateValue,
  type ValueInput,
  type WritableProperty,
} from "../domain/value.js";
import type { RecordDependencies, RecordRow } from "./ports.js";

const VERB = { CREATE: "Created", UPDATE: "Updated", DELETE: "Deleted" } as const;

export interface ValueWriteResult {
  readonly record: ComputedRecord;
  readonly totals: Record<string, string | null>;
}

export function createRecordUseCases(dependencies: RecordDependencies) {
  const assertCan = (
    actor: ActorContext,
    action: "create" | "update" | "delete",
    resource: "record" | "value",
  ) => {
    if (!can(actor, action, resource)) {
      throw new AppError("forbidden", `Your role may not ${action} a ${resource}`);
    }
  };

  const reachRecord = async (actor: ActorContext, id: string): Promise<RecordRow> => {
    const record = await dependencies.records.findReachable(actor, id);
    if (!record) throw new AppError("not-found", "Record not found");
    return record;
  };

  const assertDayIsFree = async (campaignId: string, date: Date, exceptId?: string) => {
    const existing = await dependencies.records.findByDay(campaignId, date);
    if (existing && existing.id !== exceptId) {
      throw new AppError("conflict", `The campaign already has a record for ${existing.date}`);
    }
  };

  /** The recomputed row and column totals, which is what a cell write answers
   * with: one edit can change every derived column on the row and its total. */
  const recomputed = async (
    actor: ActorContext,
    campaignId: string,
    recordId: string,
  ): Promise<ValueWriteResult> => {
    const table = await dependencies.campaigns.readTable(actor, campaignId);
    const record = table?.records.find((candidate) => candidate.id === recordId);
    if (!record) throw new AppError("not-found", "Record not found");
    return { record, totals: table!.totals };
  };

  /** Resolves and validates the cells a write names, before anything is
   * stored: a bulk write is one action, and half of it landing would be worse
   * than none of it. */
  const prepare = async (actor: ActorContext, recordId: string, inputs: readonly ValueInput[]) => {
    const record = await reachRecord(actor, recordId);
    assertCan(actor, "update", "value");

    const propertyIds = inputs.map((input) => input.propertyId);
    const properties = await dependencies.values.propertiesOf(record.campaignId, propertyIds);
    if (properties.length !== new Set(propertyIds).size) {
      throw new AppError("not-found", "Property not found in this campaign");
    }
    const byId = new Map(properties.map((property) => [property.id, property]));
    for (const input of inputs) validateValue(byId.get(input.propertyId)!, input.value);
    return { record, properties, byId };
  };

  const store = async (
    transaction: Parameters<Parameters<typeof dependencies.unitOfWork.run>[0]>[0],
    recordId: string,
    byId: Map<string, WritableProperty>,
    inputs: readonly ValueInput[],
  ) => {
    for (const input of inputs) {
      const property = byId.get(input.propertyId)!;
      await dependencies.values.write(
        transaction, recordId, property, normalizeValue(property, input.value),
      );
    }
  };

  return {
    create: async (actor: ActorContext, campaignId: string, input: { date: string }) => {
      const context = await dependencies.campaigns.contextFor(actor, campaignId);
      assertCan(actor, "create", "record");
      if (!context) throw new AppError("not-found", "Campaign not found");
      const date = parseDay(input.date);
      await assertDayIsFree(campaignId, date);
      return dependencies.unitOfWork.run(async (transaction) => {
        const record = await dependencies.records.create(transaction, {
          id: dependencies.ids.generate(), campaignId, date,
        });
        await dependencies.audit.append(transaction, {
          action: "CREATE", entityType: "record", entityId: record.id, campaignId,
          summary: `${VERB.CREATE} row ${record.date}`,
        }, actor);
        return record;
      });
    },

    update: async (actor: ActorContext, id: string, input: { date: string }) => {
      const record = await reachRecord(actor, id);
      assertCan(actor, "update", "record");
      const date = parseDay(input.date);
      await assertDayIsFree(record.campaignId, date, id);
      return dependencies.unitOfWork.run(async (transaction) => {
        const updated = await dependencies.records.update(transaction, id, date);
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "record", entityId: id, campaignId: record.campaignId,
          summary: `${VERB.UPDATE} row ${updated.date}`,
        }, actor);
        return updated;
      });
    },

    delete: async (actor: ActorContext, id: string) => {
      const record = await reachRecord(actor, id);
      assertCan(actor, "delete", "record");
      await dependencies.unitOfWork.run(async (transaction) => {
        await dependencies.records.delete(transaction, id);
        await dependencies.audit.append(transaction, {
          action: "DELETE", entityType: "record", entityId: id, campaignId: record.campaignId,
          summary: `${VERB.DELETE} row ${record.date}`,
        }, actor);
      });
    },

    /**
     * One cell. The event names the cell rather than the row — that is the
     * question the trail is asked about a single edit ("who changed this
     * cell"), and the composite entity id is what makes it addressable.
     */
    setValue: async (
      actor: ActorContext,
      recordId: string,
      propertyId: string,
      value: string | null,
    ): Promise<ValueWriteResult> => {
      const inputs = [{ propertyId, value }];
      const { record, byId } = await prepare(actor, recordId, inputs);
      const property = byId.get(propertyId)!;
      const context = await dependencies.campaigns.contextFor(actor, record.campaignId);

      await dependencies.unitOfWork.run(async (transaction) => {
        await store(transaction, recordId, byId, inputs);
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "value",
          entityId: `${recordId}:${propertyId}`,
          clientId: context?.clientId ?? null, projectId: context?.projectId ?? null,
          campaignId: record.campaignId,
          summary: `Updated column “${property.name}” on row ${record.date}`,
        }, actor);
      });
      return recomputed(actor, record.campaignId, recordId);
    },

    /**
     * Several cells of one row, as one action and therefore one event carrying
     * every column it touched with the value it held before and holds now.
     */
    setValues: async (
      actor: ActorContext,
      recordId: string,
      values: readonly ValueInput[],
    ): Promise<ValueWriteResult> => {
      const { record, properties, byId } = await prepare(actor, recordId, values);
      const stored = await dependencies.values.storedFor(
        recordId, values.map((input) => input.propertyId),
      );
      const changes = describeChanges(properties, stored, values);
      const context = await dependencies.campaigns.contextFor(actor, record.campaignId);

      await dependencies.unitOfWork.run(async (transaction) => {
        await store(transaction, recordId, byId, values);
        await dependencies.audit.append(transaction, {
          action: "UPDATE", entityType: "record", entityId: recordId,
          clientId: context?.clientId ?? null, projectId: context?.projectId ?? null,
          campaignId: record.campaignId,
          summary: `${VERB.UPDATE} row ${record.date}`,
          changes: changes as unknown as JsonValue,
        }, actor);
      });
      return recomputed(actor, record.campaignId, recordId);
    },
  };
}

export type RecordUseCases = ReturnType<typeof createRecordUseCases>;
