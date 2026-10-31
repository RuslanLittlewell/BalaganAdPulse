import { Send } from "lucide-react";
import { t } from "@/shared/config/index.js";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/index.js";
import { useTelegramStatus } from "../api/queries.js";
import { TelegramBotSection } from "./TelegramBotSection.js";

export function TelegramBotButton() {
  const status = useTelegramStatus(false);
  const bot = status.data;
  if (!bot?.available) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" data-linked={bot.linked} className="relative max-md:size-10">
          <Send aria-hidden className="size-4" />
          <span className="sr-only md:not-sr-only">{t("telegram.button")}</span>
          {bot.linked && (
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-emerald-500 max-md:absolute max-md:right-2 max-md:top-2"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[28rem] max-w-[calc(100vw-2rem)]">
        <TelegramBotSection />
      </PopoverContent>
    </Popover>
  );
}
