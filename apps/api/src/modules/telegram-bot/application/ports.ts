import type { ActorContext, Clock, IdGenerator } from "#shared/application/index.js";
import type { CreateTaskInput } from "#modules/tasks/index.js";
import type { BotMembership } from "../domain/link.js";
import type { KeyedCatalog, ReadTask, TaskCatalog, TaskDraft } from "../domain/draft.js";
import type { LocalMoment } from "../domain/moment.js";

export class ServiceBusyError extends Error {
  constructor(service: string) {
    super(`${service} is over its limit`);
    this.name = "ServiceBusyError";
  }
}

export interface TelegramChat {
  readonly id: number;
  readonly username: string | null;
}

export interface TelegramLinkView {
  readonly username: string | null;
  readonly linkedAt: Date;
}

export interface TelegramLinks {
  find(membershipId: string): Promise<TelegramLinkView | null>;
  memberOf(chatId: number): Promise<string | null>;
  issueToken(membershipId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  redeem(tokenHash: string, now: Date, chat: TelegramChat): Promise<string | null>;
  unlink(membershipId: string): Promise<void>;
}

export interface TelegramMembers {
  describe(membershipId: string): Promise<(BotMembership & { actor: ActorContext }) | null>;
}

export interface LinkTokens {
  issue(): { token: string; hash: string };
  hash(token: string): string;
}

export interface BotIdentity {
  username(): Promise<string>;
}

export interface TaskCatalogs {
  catalog(actor: ActorContext): Promise<TaskCatalog>;
}

export interface VoiceFiles {
  download(fileId: string): Promise<Uint8Array>;
}

export interface SpeechToText {
  transcribe(audio: Uint8Array): Promise<string>;
}

export interface ReadingContext {
  readonly now: LocalMoment;
  readonly timeZone: string;
  readonly catalog: KeyedCatalog;
}

export interface TaskReader {
  read(text: string, context: ReadingContext): Promise<ReadTask>;
}

export interface StoredDraft {
  readonly membershipId: string;
  readonly draft: TaskDraft;
}

export interface TaskDrafts {
  save(id: string, chatId: number, stored: StoredDraft, at: Date): Promise<void>;
  take(id: string, chatId: number, notBefore: Date): Promise<StoredDraft | null>;
  sweep(before: Date): Promise<void>;
}

export interface TaskCreation {
  create(actor: ActorContext, input: CreateTaskInput): Promise<{ readonly id: string; readonly title: string }>;
}

export interface TelegramLinkDependencies {
  readonly links: TelegramLinks;
  readonly members: TelegramMembers;
  readonly tokens: LinkTokens;
  readonly identity: BotIdentity | null;
  readonly clock: Clock;
}

export interface TaskDraftDependencies {
  readonly links: Pick<TelegramLinks, "memberOf">;
  readonly members: TelegramMembers;
  readonly catalogs: TaskCatalogs;
  readonly voices: VoiceFiles;
  readonly speech: SpeechToText;
  readonly reader: TaskReader;
  readonly drafts: TaskDrafts;
  readonly tasks: TaskCreation;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly timeZone: string;
}
