import { useState } from "react";
import { CalendarIcon } from "lucide-react";
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
  Switch,
  TimeInput,
  dayLabel,
} from "@/shared/ui/index.js";
import SpringCheck from "@/shared/ui/SpringCheck/SpringCheck.js";
import {
  TASK_REPEATS,
  endEnteredAs,
  endKeepingLength,
  endShownAs,
  mayBeCall,
  type TaskRepeat,
} from "@/entities/task/index.js";

export interface TaskScheduleProps {
  dueDate: string | null;
  dueTime: string | null;
  endTime: string | null;
  repeatEvery: TaskRepeat;
  skipWeekends: boolean;
  isCall: boolean;
  today: string;
  onDueDateChange: (dueDate: string | null) => void;
  onDueTimeChange: (dueTime: string | null) => void;
  onEndTimeChange: (endTime: string | null) => void;
  onRepeatChange: (repeatEvery: TaskRepeat) => void;
  onSkipWeekendsChange: (skipWeekends: boolean) => void;
  onCallChange: (isCall: boolean) => void;
  endError?: string;
}

export function TaskSchedule({
  dueDate,
  dueTime,
  endTime,
  repeatEvery,
  skipWeekends,
  isCall,
  today,
  onDueDateChange,
  onDueTimeChange,
  onEndTimeChange,
  onRepeatChange,
  onSkipWeekendsChange,
  onCallChange,
  endError,
}: TaskScheduleProps) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="grid gap-2" data-testid="task-form-schedule">
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
            <Button type="button" variant="outline" className="min-w-0 flex-1 justify-start gap-2 bg-transparent dark:bg-transparent">
              <CalendarIcon className="size-3 shrink-0" />
              <span className="truncate">
                {dueDate === null ? t("tasks.form.noDue") : dayLabel(dueDate)}
              </span>
            </Button>
          </DatePicker>
        </div>
      </div>

      {dueDate === null ? null : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="task-due-time">{t("tasks.form.start")}</Label>
              <TimeInput
                id="task-due-time"
                value={dueTime}
                onChange={(next) => {
                  onDueTimeChange(next);
                  onEndTimeChange(endKeepingLength(dueTime, endTime, next));
                }}
              />
            </div>

            {dueTime === null ? null : (
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="task-end-time">{t("tasks.form.end")}</Label>
                <TimeInput
                  id="task-end-time"
                  value={endShownAs(endTime)}
                  aria-invalid={endError ? true : undefined}
                  aria-describedby={endError ? "task-end-time-error" : undefined}
                  onChange={(next) => onEndTimeChange(endEnteredAs(next))}
                />
              </div>
            )}
          </div>
          {endError ? (
            <p id="task-end-time-error" role="alert" className="text-sm text-destructive">
              {endError}
            </p>
          ) : null}

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

          {repeatEvery === "NONE" ? null : (
            <SpringCheck
              checked={skipWeekends}
              onChange={onSkipWeekendsChange}
              label={t("tasks.form.skipWeekends")}
              strike="none"
              doneOpacity={1}
              boxSize={18}
              boxRadius={6}
              fontSize={14}
              color="var(--foreground)"
              fillColor="var(--primary)"
              checkColor="var(--primary-foreground)"
            />
          )}

          {mayBeCall({ dueTime }) ? (
            <div className="flex items-center gap-2">
              <Switch id="task-call" checked={isCall} onCheckedChange={onCallChange} />
              <Label htmlFor="task-call" className="text-sm font-normal">{t("tasks.form.call")}</Label>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
