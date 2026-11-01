import { MemberAvatar, type Membership } from "@/entities/membership/index.js";
import type { Task } from "@/entities/task/index.js";
import { t } from "@/shared/config/index.js";
import WarmTooltip, { WarmTooltipGroup } from "@/shared/ui/WarmTooltip/WarmTooltip.js";

const SHOWN = 3;

export interface TaskParticipantsProps {
  task: Pick<Task, "id" | "participantIds">;
  people: readonly Membership[];
}

export function TaskParticipants({ task, people }: TaskParticipantsProps) {
  if (task.participantIds.length === 0) {
    return (
      <span className="shrink-0 text-xs text-muted-foreground" data-testid={`task-participants-${task.id}`}>
        {t("tasks.participants.nobody")}
      </span>
    );
  }

  const shown = people.slice(0, SHOWN);
  const rest = task.participantIds.length - shown.length;

  return (
    <WarmTooltipGroup>
      <span className="flex shrink-0 items-center -space-x-1" data-testid={`task-participants-${task.id}`}>
        {shown.map((member) => (
          <WarmTooltip key={member.id} content={member.name} side="top">
            <span role="img" aria-label={member.name}>
              <span aria-hidden className="contents">
                <MemberAvatar member={member} size="sm" />
              </span>
            </span>
          </WarmTooltip>
        ))}
        {rest > 0 ? (
          <span
            aria-label={`${t("tasks.participants.more")}: ${rest}`}
            className="grid size-6 place-items-center rounded-md bg-muted text-2xs font-medium text-muted-foreground"
          >
            {`+${rest}`}
          </span>
        ) : null}
      </span>
    </WarmTooltipGroup>
  );
}
