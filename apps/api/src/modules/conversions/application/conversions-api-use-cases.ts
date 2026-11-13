import { can, type Action } from '@adpulse/access-policy';
import { AppError } from '#shared/domain/index.js';
import { localDate, type ActorContext, type Clock, type IdGenerator, type UnitOfWork } from '#shared/application/index.js';
import type { AuditWriter } from '#modules/audit/index.js';
import { CATCH_UP_MS, ConversionsApiError, RECENT_SENDS, type DatasetView, type StoredDataset } from '../domain/conversions.js';
import type { ConversionsApi, DatasetRepository, ProjectReach, ReachSource, SendQueue, TokenCipher } from './ports.js';

export interface DatasetSettings {
  datasetId: string;
  token?: string;
  testEventCode: string | null;
  currency?: string;
}

export interface ConversionsApiDependencies {
  datasets: DatasetRepository;
  queue: SendQueue;
  reach: ReachSource;
  api: ConversionsApi;
  cipher: TokenCipher;
  projects: ProjectReach;
  audit: AuditWriter;
  ids: IdGenerator;
  unitOfWork: UnitOfWork;
  clock: Clock;
}

const view = ({ datasetId, datasetName, testEventCode, currency, state, lastError, lastSentAt }: StoredDataset): DatasetView =>
  ({ datasetId, datasetName, testEventCode, currency, state, lastError, lastSentAt });

export function createConversionsApiUseCases(d: ConversionsApiDependencies) {
  async function project(actor: ActorContext, projectId: string, action: Action) {
    const found = await d.projects.findReachable(actor, projectId);
    if (!found) throw new AppError('not-found', 'Project not found');
    if (!can(actor, action, 'integration')) throw new AppError('forbidden', 'Your role may not manage integrations');
    return found;
  }

  async function checked(datasetId: string, token: string) {
    try {
      return await d.api.dataset(datasetId, token);
    } catch (error) {
      if (error instanceof ConversionsApiError) {
        throw new AppError('validation', 'Meta did not accept this dataset ID and token', [{ code: error.kind === 'TEMPORARY' ? 'PROVIDER' : 'TOKEN' }]);
      }
      throw error;
    }
  }

  function sealed<T>(work: () => T): T {
    try {
      return work();
    } catch {
      throw new AppError('validation', 'Credential encryption is not configured', [{ code: 'CONFIGURATION' }]);
    }
  }

  async function summary(projectId: string) {
    const dataset = await d.datasets.find(projectId);
    const timezone = await d.datasets.timezone(projectId);
    const [counts, recent] = await Promise.all([
      d.datasets.counts(projectId, timezone, localDate(d.clock.now(), timezone)),
      d.datasets.recent(projectId, RECENT_SENDS),
    ]);
    return { dataset: dataset && view(dataset), counts, recent };
  }

  return {
    async read(actor: ActorContext, projectId: string) {
      await project(actor, projectId, 'read');
      return summary(projectId);
    },

    async save(actor: ActorContext, projectId: string, settings: DatasetSettings) {
      const target = await project(actor, projectId, 'update');
      const existing = await d.datasets.find(projectId);
      const datasetChanged = !existing || existing.datasetId !== settings.datasetId;
      if (datasetChanged && !settings.token) throw new AppError('validation', 'A token is required to connect a dataset');
      const currency = settings.currency ?? existing?.currency ?? target.budgetCurrency;
      if (!currency) throw new AppError('validation', 'Choose the currency of lead amounts');
      const token = settings.token ?? sealed(() => d.cipher.decrypt(existing!.encryptedToken, projectId));
      const encryptedToken = sealed(() => d.cipher.encrypt(token, projectId));
      const tokenChanged = settings.token !== undefined || datasetChanged;
      const datasetName = tokenChanged ? (await checked(settings.datasetId, token)).name : existing!.datasetName;
      await d.unitOfWork.run(async (context) => {
        await d.datasets.save(context, {
          projectId, orgId: actor.orgId, datasetId: settings.datasetId, datasetName,
          encryptedToken, testEventCode: settings.testEventCode, currency,
          revision: d.ids.generate(), tokenChanged,
        });
        if (!existing) {
          const now = d.clock.now();
          await d.queue.queue(context, await d.reach.reachedSince(context, projectId, new Date(now.getTime() - CATCH_UP_MS)), now);
        }
        await d.audit.append(context, {
          action: 'UPDATE', entityType: 'project', entityId: projectId, projectId, clientId: target.clientId,
          summary: existing ? 'Update Meta dataset' : 'Connect Meta dataset',
        }, actor);
      });
      return summary(projectId);
    },

    async disconnect(actor: ActorContext, projectId: string) {
      const target = await project(actor, projectId, 'delete');
      if (!await d.datasets.find(projectId)) throw new AppError('not-found', 'No dataset is connected');
      await d.unitOfWork.run(async (context) => {
        await d.datasets.remove(context, projectId);
        await d.audit.append(context, {
          action: 'UPDATE', entityType: 'project', entityId: projectId, projectId, clientId: target.clientId,
          summary: 'Disconnect Meta dataset',
        }, actor);
      });
    },
  };
}

export type ConversionsApiUseCases = ReturnType<typeof createConversionsApiUseCases>;
