import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLeads, type Lead } from "@/entities/lead/index.js";
import { LeadCard } from "@/widgets/crm-board/LeadCard.js";
import {
  dayAndMonth,
  dayTitle,
  shiftWeek,
  startOfWeek,
  weekDays,
  weekdayName,
  weekLabel,
} from "@/widgets/task-calendar/week.js";
import { t } from "@/shared/config/index.js";
import { cn } from "@/shared/lib/index.js";
import { Button, EmptyState, Loader, toIso } from "@/shared/ui/index.js";
import { leadsOfDay } from "./day.js";

export interface CrmCalendarProps {
  boardKey?: string;
  busy?: boolean;
  today?: string;
  onOpen?: (lead: Lead) => void;
}

export function CrmCalendar({ boardKey, busy = false, today, onOpen }: CrmCalendarProps) {
  const now = today ?? toIso(new Date());
  const { data: leads, isLoading, isError } = useLeads(boardKey);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const board = leads ?? [];
  const loading = busy || isLoading;

  if (isError && board.length === 0) return <EmptyState title={t("crm.loadFailed")} />;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("crm.calendar.previousWeek")}
          onClick={() => setWeekStart((start) => shiftWeek(start, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("crm.calendar.nextWeek")}
          onClick={() => setWeekStart((start) => shiftWeek(start, 1))}
        >
          <ChevronRight />
        </Button>
        <h2 className="min-w-0 truncate text-sm font-semibold">{weekLabel(weekStart)}</h2>
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          onClick={() => setWeekStart(startOfWeek(now))}
        >
          {t("crm.calendar.today")}
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div
            data-testid="crm-calendar-loading"
            className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/40"
          >
            <span className="rounded-lg border border-border bg-background px-4 py-3 shadow-lg">
              <Loader />
            </span>
          </div>
        ) : null}

        <div className="grid h-full min-h-0 grid-cols-7 gap-3 overflow-x-auto">
          {days.map((day) => {
            const dayLeads = leadsOfDay(board, day);
            return (
              <section
                key={day}
                role="group"
                aria-label={dayTitle(day)}
                data-testid={`crm-calendar-day-${day}`}
                data-today={day === now ? "true" : undefined}
                className={cn(
                  "flex min-h-0 min-w-40 flex-col rounded-xl border border-border bg-muted/30 shadow-sm",
                  day === now && "border-primary/40 bg-primary/5",
                )}
              >
                <header className="flex shrink-0 flex-col items-center gap-0.5 border-b border-border/70 px-2 py-2 text-center">
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {weekdayName(day)}
                  </span>
                  <span className={cn("text-sm font-semibold", day === now && "text-primary")}>
                    {dayAndMonth(day)}
                  </span>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {dayLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onOpen={onOpen} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
