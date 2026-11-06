import { useId, useState, type ClipboardEvent, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { ImagePlusIcon, XIcon } from "lucide-react";
import { useAuth } from "@/features/auth/index.js";
import { t } from "@/shared/config/index.js";
import { ApiError } from "@/shared/lib/index.js";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Dropzone,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/index.js";
import { FEEDBACK_TOPICS, useSendFeedback, useSupportContacts, type FeedbackTopic } from "../api.js";
import { SCREENSHOT_TYPES, useScreenshots, type ScreenshotRefusal } from "../model/screenshots.js";

export const MAX_FEEDBACK_MESSAGE_LENGTH = 5000;

export interface HelpFeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

type Failure = "failed" | "tooMany";

const SCREENSHOT_REFUSALS: Readonly<Record<ScreenshotRefusal, string>> = {
  invalid: t("help.screenshots.invalid"),
  full: t("help.screenshots.full"),
};

export function HelpFeedbackDialog({ open, onClose }: HelpFeedbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {open && <HelpFeedbackContent onClose={onClose} />}
    </Dialog>
  );
}

function SupportEmail({ email }: { email: string }) {
  return <a href={`mailto:${email}`} className="font-medium text-primary underline-offset-2 hover:underline">{email}</a>;
}

function HelpFeedbackContent({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const location = useLocation();
  const contacts = useSupportContacts(true);
  const send = useSendFeedback();
  const { screenshots, add, remove, full } = useScreenshots();
  const [topic, setTopic] = useState<FeedbackTopic>("PROBLEM");
  const [message, setMessage] = useState("");
  const [messageProblem, setMessageProblem] = useState<string | null>(null);
  const [screenshotProblem, setScreenshotProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sent, setSent] = useState(false);
  const ids = { topic: useId(), message: useId(), messageError: useId() };
  const email = contacts.data?.email ?? null;
  const unavailable = contacts.isSuccess && !contacts.data.feedback;

  const attach = (file: File) => {
    const refusal = add(file);
    setScreenshotProblem(refusal && SCREENSHOT_REFUSALS[refusal]);
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (sent || unavailable) return;
    const images = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    event.preventDefault();
    images.forEach(attach);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = message.trim();
    if (text === "") {
      setMessageProblem(t("help.message.required"));
      return;
    }
    if (text.length > MAX_FEEDBACK_MESSAGE_LENGTH) {
      setMessageProblem(t("help.message.tooLong"));
      return;
    }
    setMessageProblem(null);
    setFailure(null);
    try {
      await send.mutateAsync({
        topic,
        message: text,
        page: `${location.pathname}${location.search}`,
        userAgent: navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`,
        screenshots: screenshots.map(({ file }) => file),
      });
      setSent(true);
    } catch (error) {
      setFailure(error instanceof ApiError && error.status === 429 ? "tooMany" : "failed");
    }
  }

  return (
    <DialogContent className="max-h-[90dvh] w-[min(560px,calc(100vw-2rem))] max-w-none overflow-y-auto" onPaste={onPaste}>
      <DialogHeader>
        <DialogTitle>{t("help.title")}</DialogTitle>
      </DialogHeader>

      {sent ? (
        <div className="flex flex-col gap-3">
          <div role="status" className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{t("help.sent.title")}</p>
            {user?.email && <p className="text-muted-foreground">{t("help.sent.reply")} {user.email}.</p>}
          </div>
          <DialogFooter>
            <Button type="button" onClick={onClose}>{t("help.done")}</Button>
          </DialogFooter>
        </div>
      ) : unavailable ? (
        <p role="status" className="text-sm">
          {email ? <>{t("help.unavailable")} <SupportEmail email={email} /></> : t("help.unavailable.noEmail")}
        </p>
      ) : (
        <form className="flex flex-col gap-3" noValidate onSubmit={(event) => void submit(event)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.topic}>{t("help.topic")}</Label>
            <Select value={topic} onValueChange={(next) => setTopic(next as FeedbackTopic)}>
              <SelectTrigger id={ids.topic} className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEEDBACK_TOPICS.map((option) => (
                  <SelectItem key={option} value={option}>{t(`help.topic.${option}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={ids.message}>{t("help.message")}</Label>
            <textarea
              id={ids.message}
              value={message}
              placeholder={t("help.message.placeholder")}
              aria-invalid={messageProblem ? true : undefined}
              aria-describedby={messageProblem ? ids.messageError : undefined}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-28 rounded-md border border-input bg-transparent p-2 text-sm outline-none transition-colors focus-visible:border-ring aria-invalid:border-destructive"
            />
            {messageProblem && <p id={ids.messageError} className="text-xs text-destructive">{messageProblem}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("help.screenshots")}</span>
            {screenshots.length > 0 && (
              <ul aria-label={t("help.screenshots")} className="flex flex-wrap gap-2">
                {screenshots.map((screenshot, index) => (
                  <li key={screenshot.id} className="relative">
                    <img
                      src={screenshot.url}
                      alt={`${t("help.screenshots")}: ${index + 1}`}
                      className="size-20 rounded-md border border-border object-cover"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-xs"
                      aria-label={`${t("help.screenshots.remove")} ${index + 1}`}
                      onClick={() => { remove(screenshot.id); setScreenshotProblem(null); }}
                      className="absolute -top-1.5 -right-1.5 rounded-full"
                    >
                      <XIcon aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Dropzone
              label={t("help.screenshots.add")}
              accept={SCREENSHOT_TYPES}
              disabled={full}
              onFile={attach}
              className="rounded-md border border-dashed border-border p-3"
            >
              <span className="flex items-center gap-2 text-sm">
                <ImagePlusIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                {t("help.screenshots.add")}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{t("help.screenshots.hint")}</span>
            </Dropzone>
            {screenshotProblem && <p role="alert" className="text-xs text-destructive">{screenshotProblem}</p>}
          </div>

          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure === "tooMany" ? t("help.tooMany") : t("help.failed")}
              {failure === "failed" && email && <> <SupportEmail email={email} /></>}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("action.cancel")}</Button>
            <Button type="submit" disabled={send.isPending}>{t("help.send")}</Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}
