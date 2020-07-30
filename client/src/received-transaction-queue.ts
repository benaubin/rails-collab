import type { ServerTransaction } from "./connection";

/** A class which handles re-ordering transactions sent out of order */
export default class ReceivedTransactionQueue {
  queue: {
    [version: number]: ServerTransaction | undefined;
  } = {};

  nextVersion: number;
  onBatch: (batch: ServerTransaction[]) => void;

  constructor(
    startingVersion: number,
    onBatch: (batch: ServerTransaction[]) => void
  ) {
    this.nextVersion = startingVersion + 1;
    this.onBatch = onBatch;
  }

  /** Get the longest-possible unbroken ordered sequence of transactions out of the queue of transactions, starting at `version` */
  dequeueFrom(version: number): ServerTransaction[] {
    const transactions: ServerTransaction[] = [];
    for (let t; (t = this.queue[version]); version++) {
      transactions.push(t);
      delete this.queue[version];
      version++;
    }
    return transactions;
  }

  receive(transaction: ServerTransaction) {
    if (this.nextVersion > transaction.v) return; // This is an old transaction - ignore it.

    if (this.nextVersion === transaction.v) {
      const batch = this.dequeueFrom(transaction.v + 1);
      batch.unshift(transaction);
      this.nextVersion += batch.length;
      this.onBatch(batch);
    } else {
      this.queue[transaction.v] = transaction; // Future transaction, queue for later
    }
  }
}
