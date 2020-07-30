import type { Cable, Channel } from "actioncable";
import ReceivedTransactionQueue from "./received-transaction-queue";

export type ServerTransaction = {
  v: number;
  steps: { [k: string]: unknown }[];
  ref?: string | null;
};

/** Handles the networking for collaboration */
export default class CollaborationConnection {
  cable: Cable;
  documentId: string;
  channel?: Channel;

  constructor(
    documentId: string,
    cable: Cable,
    startingVersion: number,
    onTransactionBatch: (batch: ServerTransaction[]) => void
  ) {
    this.documentId = documentId;
    this.cable = cable;

    const transactionQueue = new ReceivedTransactionQueue(
      startingVersion,
      onTransactionBatch
    );

    this.channel = this.cable.subscriptions.create(
      {
        channel: "CollaborativeDocumentChannel",
        id: this.documentId,
        after_version: startingVersion,
      },
      {
        received: (tr) => transactionQueue.receive(tr),
      }
    );
  }

  close() {
    if (this.channel) this.channel.unsubscribe();
  }

  /** This needs to be throttled to prevent overwhelming the server, or running into (very tricky) potential silent rate-limiting. */
  submitTransaction(data: ServerTransaction) {
    if (this.channel == null)
      throw {
        name: "CollabInvariant",
        message: "Tried to submit steps before starting subscription",
      };

    this.channel.perform("submit_transaction", data);
  }
}
