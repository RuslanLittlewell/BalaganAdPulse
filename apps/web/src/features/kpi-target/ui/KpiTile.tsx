import { Fragment, useState } from "react";
import {
  useKpi,
  useProjectKpis,
  type KpiFigures,
  type KpiScope,
  type ProjectKpi,
  type SingleKpiScope,
} from "@/entities/kpi/index.js";
import { type Currency } from "@/shared/lib/index.js";
import { KpiCard } from "./KpiCard.js";
import { KpiTargetDialog } from "./KpiTargetDialog.js";
import { ProjectKpiDialog } from "./ProjectKpiDialog.js";

export interface KpiTileProps {
  scope: KpiScope;
  canEdit: boolean;
  figures: KpiFigures;
  range: { from: string; to: string };
  currency: Currency;
  currencyFigures?: { currency: Currency; performance: KpiFigures }[];
  preview?: boolean;
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
      {editing ? <KpiTargetDialog scope={scope} kpi={current} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

function ProjectKpiTiles({
  projectId,
  canEdit,
  preview = false,
  ...rest
}: Omit<KpiTileProps, "scope"> & { projectId: string }) {
  const kpis = useProjectKpis(projectId);
  const [editing, setEditing] = useState(false);
  const listed: readonly ProjectKpi[] = kpis.data ?? [];
  const shownKpis = preview ? listed.slice(0, 1) : listed;
  const controls = canEdit && !preview;
  const card = (kpi: ProjectKpi | null, key: string) => {
    const content = (
      <KpiCard
        {...rest}
        kpi={kpi}
        enabled={kpi?.enabled ?? true}
        pending={kpis.isPending}
        controls={controls}
        onEdit={() => setEditing(true)}
      />
    );
    return preview ? <Fragment key={key}>{content}</Fragment> : (
      <div key={key} data-testid="summary-tile" data-tile="KPI">{content}</div>
    );
  };

  return (
    <>
      {shownKpis.length > 0 ? shownKpis.map((kpi, position) => card(kpi, String(position))) : [card(null, "0")]}
      {editing ? <ProjectKpiDialog projectId={projectId} kpis={listed} {...rest} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

export function KpiTile({ scope, ...props }: KpiTileProps) {
  return scope.kind === "project"
    ? <ProjectKpiTiles projectId={scope.id} {...props} />
    : <SingleKpiTile scope={scope} {...props} />;
}
