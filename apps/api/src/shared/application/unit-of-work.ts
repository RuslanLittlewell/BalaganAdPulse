declare const transactionContextBrand: unique symbol;

/** Opaque capability passed to ports participating in one atomic operation. */
export interface TransactionContext {
  readonly [transactionContextBrand]: true;
}

export interface UnitOfWork {
  run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}
