import type { Clock, UnitOfWork } from '#shared/application/index.js';
import { ConversionsApiError, outgoingEvent, SEND_BATCH, type DatasetJob, type DueSend } from '../domain/conversions.js';
import type { ConversionJobs, ConversionsApi, ReachSource, TokenCipher } from './ports.js';

const CHANGE_BATCH = 500;
const CHANGE_ROUNDS = 10;
const SEND_ROUNDS = 10;
const DATASETS_PER_TICK = 20;
const TICK_MS = 60_000;

export interface ConversionWorkerDependencies {
  jobs: ConversionJobs;
  reach: Pick<ReachSource, 'reachedByChanges'>;
  api: ConversionsApi;
  cipher: TokenCipher;
  unitOfWork: UnitOfWork;
  clock: Clock;
}

export function createConversionWorker(d: ConversionWorkerDependencies) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let active: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let stopped = false;

  const queueChanges = () => d.unitOfWork.run(async (context) => {
    const ids = await d.jobs.claimChanges(context, CHANGE_BATCH);
    if (ids.length === 0) return 0;
    const now = d.clock.now();
    await d.jobs.queue(context, await d.reach.reachedByChanges(context, ids), now);
    await d.jobs.markProcessed(context, ids, now);
    return ids.length;
  });

  const sendBatch = async (job: DatasetJob, token: string, sends: readonly DueSend[], signal: AbortSignal): Promise<'continue' | 'stop'> => {
    const events = sends.map((send) => outgoingEvent(send, job.currency));
    try {
      await d.api.send(job.datasetId, token, events, job.testEventCode, signal);
      await d.jobs.sent(job, events.map(({ id, value, currency }) => ({ id, value, currency })), d.clock.now());
      return 'continue';
    } catch (error) {
      if (!(error instanceof ConversionsApiError)) throw error;
      if (error.kind === 'AUTH') {
        await d.jobs.requireToken(job, error.reason, d.clock.now());
        return 'stop';
      }
      if (error.kind === 'TEMPORARY') {
        await d.jobs.retry(job, sends.map((send) => send.id), error.reason || error.detail, d.clock.now());
        return 'stop';
      }
      if (sends.length === 1) {
        await d.jobs.refused(job, sends[0]!.id, error.reason, d.clock.now());
        return 'continue';
      }
      for (const send of sends) {
        if (await sendBatch(job, token, [send], signal) === 'stop') return 'stop';
      }
      return 'continue';
    }
  };

  const sendDue = async (signal: AbortSignal) => {
    const job = await d.jobs.claim(d.clock.now());
    if (!job) return false;
    try {
      const token = d.cipher.decrypt(job.encryptedToken, job.projectId);
      for (let round = 0; round < SEND_ROUNDS && !signal.aborted; round++) {
        const due = await d.jobs.due(job, d.clock.now(), SEND_BATCH);
        if (due.length === 0) break;
        if (await sendBatch(job, token, due, signal) === 'stop') break;
      }
    } catch (error) {
      console.error('Meta conversion send failed:', error instanceof ConversionsApiError ? error.detail : error instanceof Error ? error.message : error);
    } finally {
      await d.jobs.release(job);
    }
    return true;
  };

  const runOnce = async () => {
    controller = new AbortController();
    const signal = controller.signal;
    for (let round = 0; round < CHANGE_ROUNDS && !stopped; round++) {
      if (await queueChanges() < CHANGE_BATCH) break;
    }
    await d.jobs.expire(d.clock.now());
    for (let index = 0; index < DATASETS_PER_TICK && !stopped; index++) {
      if (!await sendDue(signal)) break;
    }
  };

  const tick = () => {
    if (stopped || active) return;
    active = runOnce()
      .catch((error) => { console.error('Meta conversion worker failed; pending work will be retried:', error instanceof Error ? error.message : error); })
      .finally(() => { active = undefined; controller = undefined; });
  };

  return {
    runOnce,
    start() { if (timer) return; stopped = false; timer = setInterval(tick, TICK_MS); tick(); },
    async stop() { stopped = true; clearInterval(timer); timer = undefined; controller?.abort(); await active; },
  };
}

export type ConversionWorker = ReturnType<typeof createConversionWorker>;
