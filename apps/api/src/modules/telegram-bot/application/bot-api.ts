export interface BotChat {
  readonly id: number;
  readonly private: boolean;
}

export interface BotMessage {
  readonly id: number;
  readonly chat: BotChat;
  readonly username: string | null;
  readonly text: string | null;
  readonly voice: { readonly fileId: string; readonly duration: number } | null;
}

export interface BotCallback {
  readonly id: string;
  readonly data: string | null;
  readonly message: { readonly id: number; readonly chat: BotChat } | null;
}

export interface BotUpdate {
  readonly id: number;
  readonly message: BotMessage | null;
  readonly callback: BotCallback | null;
}

export interface BotButton {
  readonly text: string;
  readonly data: string;
}

export interface BotReply {
  readonly html: string;
  readonly buttons?: readonly (readonly BotButton[])[];
  readonly menu?: readonly string[];
}

export interface BotCommand {
  readonly command: string;
  readonly description: string;
}

export interface BotApi {
  getUpdates(offset: number | null, timeoutSeconds: number, signal: AbortSignal): Promise<BotUpdate[]>;
  sendMessage(chatId: number, reply: BotReply): Promise<void>;
  editMessage(chatId: number, messageId: number, reply: BotReply): Promise<void>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
  showTyping(chatId: number): Promise<void>;
  setCommands(commands: readonly BotCommand[]): Promise<void>;
}
