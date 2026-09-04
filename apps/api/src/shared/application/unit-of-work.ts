declare const transactionContextBrand: unique symbol;

export interface TransactionContext {
  readonly [transactionContextBrand]: true;
}

export interface UnitOfWork {
  run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}
