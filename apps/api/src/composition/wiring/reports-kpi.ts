import { prisma } from "#shared/infrastructure/prisma.js";
import { createKpiRouter, createKpiUseCases } from "#modules/kpi/index.js";
import { PrismaKpiRepository } from "#modules/kpi/infrastructure/prisma-kpi-repository.js";
import { createReportIndexRouter, createReportRouter, createReportUseCases } from "#modules/reports/index.js";
import { PrismaReportMetrics } from "#modules/reports/infrastructure/prisma-report-metrics.js";
import { PrismaReportRepository } from "#modules/reports/infrastructure/prisma-report-repository.js";
import { S3ReportCoverStorage } from "#modules/reports/infrastructure/s3-report-cover-storage.js";
import type { CampaignsAndIntegrations } from "./campaigns-integrations.js";
import type { ClientsAndProjects } from "./clients-projects.js";
import type { Kernel } from "./kernel.js";

export function wireReportsAndKpi(
  { unitOfWork, clock, ids, audit }: Kernel,
  { projectRepository, campaignRepository }:
    Pick<ClientsAndProjects, "projectRepository"> & Pick<CampaignsAndIntegrations, "campaignRepository">,
) {
  const reports = createReportUseCases({
    reports: new PrismaReportRepository(prisma, unitOfWork),
    projects: projectRepository,
    metrics: new PrismaReportMetrics(prisma),
    covers: new S3ReportCoverStorage(),
    audit,
    unitOfWork,
    clock,
    ids,
  });
  const kpis = createKpiUseCases({
    kpis: new PrismaKpiRepository(prisma, unitOfWork),
    reach: { projects: projectRepository, campaigns: campaignRepository },
    audit,
    unitOfWork,
    clock,
  });
  return {
    reportRouter: createReportRouter(reports),
    reportIndexRouter: createReportIndexRouter(reports),
    kpiRouter: createKpiRouter(kpis),
  };
}
