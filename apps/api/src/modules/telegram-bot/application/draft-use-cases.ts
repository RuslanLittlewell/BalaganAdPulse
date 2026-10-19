import { AppError } from "#shared/domain/index.js";
import type { ActorContext } from "#shared/application/index.js";
import {
  DRAFT_TTL_MS,
  MAX_VOICE_SECONDS,
  descriptionOf,
  draftFrom,
  keyedCatalog,
  type TaskDraft,
} from "../domain/draft.js";
import { localMoment } from "../domain/moment.js";
import { botActorOf } from "./link-use-cases.js";
import { ServiceBusyError, type TaskDraftDependencies } from "./ports.js";

export interface Voice {
  readonly fileId: string;
  readonly duration: number;
}

export type DraftOutcome =
  | { readonly kind: "unlinked" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "too-long" }
  | { readonly kind: "unheard" }
  | { readonly kind: "busy" }
  | { readonly kind: "drafted"; readonly id: string; readonly draft: TaskDraft; readonly heard: string | null };

export type ConfirmOutcome =
  | { readonly kind: "gone" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "failed" }
  | { readonly kind: "created"; readonly task: { readonly id: string; readonly title: string } };

export type CancelOutcome = { readonly kind: "gone" } | { readonly kind: "cancelled" };

type Sender =
  | { readonly kind: "unlinked" | "forbidden" }
  | { readonly kind: "member"; readonly actor: ActorContext };

export function createTaskDraftUseCases(d: TaskDraftDependencies) {
  const sender = async (chatId: number): Promise<Sender> => {
    const membershipId = await d.links.memberOf(chatId);
    if (membershipId === null) return { kind: "unlinked" };
    const actor = await botActorOf(d.members, membershipId);
    return actor ? { kind: "member", actor } : { kind: "forbidden" };
  };

  const drafted = async (
    chatId: number, actor: ActorContext, text: string, heard: string | null,
  ): Promise<DraftOutcome> => {
    const now = d.clock.now();
    const catalog = keyedCatalog(await d.catalogs.catalog(actor), actor.membershipId);
    const read = await d.reader.read(text, { now: localMoment(now, d.timeZone), timeZone: d.timeZone, catalog });
    const draft = draftFrom(read, catalog, text);
    const id = d.ids.generate();
    await d.drafts.sweep(new Date(now.getTime() - DRAFT_TTL_MS));
    await d.drafts.save(id, chatId, { membershipId: actor.membershipId, draft }, now);
    return { kind: "drafted", id, draft, heard };
  };

  const busyAware = async (work: () => Promise<DraftOutcome>): Promise<DraftOutcome> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ServiceBusyError) return { kind: "busy" };
      throw error;
    }
  };

  const takeOwn = async (chatId: number, draftId: string) => {
    const membershipId = await d.links.memberOf(chatId);
    if (membershipId === null) return null;
    const stored = await d.drafts.take(draftId, chatId, new Date(d.clock.now().getTime() - DRAFT_TTL_MS));
    return stored && stored.membershipId === membershipId ? stored : null;
  };

  return {
    async fromVoice(chatId: number, voice: Voice): Promise<DraftOutcome> {
      const from = await sender(chatId);
      if (from.kind !== "member") return from;
      if (voice.duration > MAX_VOICE_SECONDS) return { kind: "too-long" };
      return busyAware(async () => {
        const heard = (await d.speech.transcribe(await d.voices.download(voice.fileId))).trim();
        if (heard.length === 0) return { kind: "unheard" };
        return drafted(chatId, from.actor, heard, heard);
      });
    },

    async fromText(chatId: number, text: string): Promise<DraftOutcome> {
      const from = await sender(chatId);
      if (from.kind !== "member") return from;
      const said = text.trim();
      if (said.length === 0) return { kind: "unheard" };
      return busyAware(() => drafted(chatId, from.actor, said, null));
    },

    async create(chatId: number, draftId: string): Promise<ConfirmOutcome> {
      const stored = await takeOwn(chatId, draftId);
      if (!stored) return { kind: "gone" };
      const actor = await botActorOf(d.members, stored.membershipId);
      if (!actor) return { kind: "forbidden" };
      const { draft } = stored;
      try {
        const task = await d.tasks.create(actor, {
          title: draft.title,
          description: descriptionOf(draft.details),
          projectId: draft.project?.id ?? null,
          priority: draft.priority,
          participantIds: draft.participants.map((member) => member.id),
          dueDate: draft.dueDate,
          dueTime: draft.dueTime,
          checklist: draft.checklist.map((title) => ({ title })),
        });
        return { kind: "created", task: { id: task.id, title: task.title } };
      } catch (error) {
        if (error instanceof AppError) return { kind: "failed" };
        throw error;
      }
    },

    async cancel(chatId: number, draftId: string): Promise<CancelOutcome> {
      return (await takeOwn(chatId, draftId)) ? { kind: "cancelled" } : { kind: "gone" };
    },
  };
}

export type TaskDraftUseCases = ReturnType<typeof createTaskDraftUseCases>;
