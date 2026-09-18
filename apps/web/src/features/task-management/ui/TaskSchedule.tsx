import { useState } from "react";
import { CalendarIcon, XIcon } from "lucide-react";
import { t } from "@/shared/config/index.js";
import {
  Button,
  DatePicker,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  dayLabel,
} from "@/shared/ui/index.js";
import { TASK_REPEATS, type TaskRepeat } from "@/entities/task/index.js";

export interface TaskScheduleProps {
  dueDate: string | null;
  dueTime: string | null;
  repeatEvery: TaskRepeat;
  today: string;
  onDueDateChange: (dueDate: string | null) => void;
  onDueTimeChange: (dueTime: string | null) => void;
  onRepeatChange: (repeatEvery: TaskRepeat) => void;
}

export function TaskSchedule({
  dueDate,
  dueTime,
  repeatEvery,
  today,
  onDueDateChange,
  onDueTimeChange,
  onRepeatChange,
}: TaskScheduleProps) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="task-form-schedule">
      <div className="flex min-w-0 flex-col gap-2">
        <Label>{t("tasks.form.due")}</Label>
        <div className="flex gap-1">
          <DatePicker
            value={dueDate ?? today}
            open={picking}
            onOpenChange={setPicking}
            labels={{
              dialog: t("tasks.form.pickDate"),
              previousMonth: t("tasks.form.previousMonth"),
              nextMonth: t("tasks.form.nextMonth"),
            }}
            onSelect={(value) => {
              onDueDateChange(value);
              setPicking(false);
            }}
          >
            <Button type="button" variant="outline" className="min-w-0 flex-1 justify-start gap-2">
              <CalendarIcon className="size-4 shrink-0" />
              <span className="truncate">
                {dueDate === null ? t("tasks.form.noDue") : dayLabel(dueDate)}
              </span>
            </Button>
          </DatePicker>
          {dueDate === null ? null : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("tasks.form.clearDue")}
              onClick={() => onDueDateChange(null)}
            >
              <XIcon />
            </Button>
          )}
        </div>
      </div>

      {dueDate === null ? null : (
        <>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="task-due-time">{t("tasks.form.time")}</Label>
            <input
              id="task-due-time"
              type="time"
              value={dueTime ?? ""}
              onChange={(event) => onDueTimeChange(event.target.value || null)}
              className={
                "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm " +
                "shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] " +
                "focus-visible:ring-ring/50"
              }
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="task-repeat">{t("tasks.form.repeat")}</Label>
            <Select value={repeatEvery} onValueChange={(value) => onRepeatChange(value as TaskRepeat)}>
              <SelectTrigger id="task-repeat" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_REPEATS.map((repeat) => (
                  <SelectItem key={repeat} value={repeat}>{t(`tasks.repeat.${repeat}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
