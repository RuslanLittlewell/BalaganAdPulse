import { Fragment, useState } from "react";
import {
  useKpi,
  useProjectKpis,
  type KpiFigures,
  type KpiScope,
  type ProjectKpi,
  type SingleKpiScope,
} from "@/entities/kpi/index.js";
import { t } from "@/shared/config/index.js";
import { type Currency } from "@/shared/lib/index.js";
import { MoveHandle, type TileMove } from "@/shared/ui/index.js";
import { KpiCard } from "./KpiCard.js";
import { isWholeProject, partHolds, type ProjectKpiPart } from "./kpiPart.js";
import { KpiTargetDialog } from "./KpiTargetDialog.js";
import { ProjectKpiDialog } from "./ProjectKpiDialog.js";

export interface KpiTileProps {
  scope: KpiScope;
  canEdit: boolean;
  figures: KpiFigures;
  range: { from: string; to: string };
  currency: Currency;
  currencyFigures?: { currency: Currency; performance: KpiFigures }[];
  part?: ProjectKpiPart;
  projectFigures?: KpiFigures;
  preview?: boolean;
  move?: TileMove;
}

function SingleKpiTile({ scope, canEdit, preview = false, ...rest }: KpiTileProps & { scope: SingleKpiScope }) {
  const kpi = useKpi(scope);
  const [editing, setEditing] = useState(false);
  const current = kpi.data ?? null;

  return (
    <>
      <KpiCard
        {...rest}
        kpi={current}
        pending={kpi.isPending}
        controls={canEdit && !preview}
        onEdit={() => setEditing(true)}
      />
      {editing ? <KpiTargetDialog scope={scope} kpi={current} range={rest.range} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

function ProjectKpiTiles({
  projectId,
  canEdit,
  preview = false,
  part = { kind: "all", account: null },
  projectFigures,
  move,
  ...rest
}: Omit<KpiTileProps, "scope"> & { projectId: string }) {
  const kpis = useProjectKpis(projectId);
  const [editing, setEditing] = useState(false);
  const listed: readonly ProjectKpi[] = kpis.data ?? [];
  const held = listed.filter((kpi) => partHolds(part, kpi));
  const shownKpis = preview ? held.slice(0, 1) : held;
  const controls = canEdit && !preview;
  const card = (kpi: ProjectKpi | null, key: string) => {
    const wholeProject = isWholeProject(part, kpi);
    const content = (
      <KpiCard
        {...rest}
        figures={wholeProject && projectFigures ? projectFigures : rest.figures}
        note={wholeProject ? t("kpi.wholeProject") : undefined}
        kpi={kpi}
        enabled={kpi?.enabled ?? true}
        pending={kpis.isPending}
        controls={controls}
        onEdit={() => setEditing(true)}
      />
    );
    return preview ? <Fragment key={key}>{content}</Fragment> : (
      <div key={key} className="group/tile relative" data-testid="summary-tile" data-tile="KPI">
        {content}
        {move ? <MoveHandle {...move} /> : null}
      </div>
    );
  };

  return (
    <>
      {shownKpis.length > 0 ? shownKpis.map((kpi, position) => card(kpi, String(position))) : [card(null, "0")]}
      {editing ? (
        <ProjectKpiDialog projectId={projectId} kpis={listed} part={part} {...rest} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}

export function KpiTile({ scope, move, ...props }: KpiTileProps) {
  return scope.kind === "project"
    ? <ProjectKpiTiles projectId={scope.id} move={move} {...props} />
    : <SingleKpiTile scope={scope} {...props} />;
}
