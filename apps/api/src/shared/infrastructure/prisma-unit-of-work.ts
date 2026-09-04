import { AsyncLocalStorage } from "node:async_hooks";
import type { TransactionContext, UnitOfWork } from "../application/unit-of-work.js";

interface PrismaTransactionHost<TClient> {
  $transaction<T>(work: (client: TClient) => Promise<T>): Promise<T>;
}

export class PrismaUnitOfWork<TClient = unknown> implements UnitOfWork {
  private readonly activeClients = new WeakMap<TransactionContext, unknown>();
  private readonly ownedContexts = new WeakSet<TransactionContext>();
  private readonly current = new AsyncLocalStorage<TransactionContext>();

  constructor(private readonly prisma: PrismaTransactionHost<TClient>) {}

  async run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    if (this.current.getStore()) throw new Error("Nested transactions are not supported");
    return this.prisma.$transaction(async (client) => {
      const context = Object.freeze({}) as TransactionContext;
      this.ownedContexts.add(context);
      this.activeClients.set(context, client);
      try {
        return await this.current.run(context, () => work(context));
      } finally {
        this.activeClients.delete(context);
      }
    });
  }

  clientFor<T = TClient>(context: TransactionContext): T {
    if (!this.ownedContexts.has(context)) throw new Error("Transaction context does not belong to this unit of work");
    const client = this.activeClients.get(context);
    if (client === undefined) throw new Error("Transaction context is no longer active");
    return client as T;
  }
}
