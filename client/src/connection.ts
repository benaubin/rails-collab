import type { Cable, Channel } from "actioncable";
import ReceivedTransactionQueue from "./received-transaction-queue";

export type ServerTransaction = {
  v: number;
  steps: { [k: string]: unknown }[];
  ref?: string | null;
};

export interface SubscriptionParams {
  channel?: string;
  startingVersion?: number;
  [k: string]: unknown;
}

/** Handles the networking for collaboration */
export default class CollaborationConnection {
  channel?: Channel;

  constructor(
    /** Params passed to the cable and passed to find_document_for_subscribe. You can override channel here */
    params: SubscriptionParams,
    cable: Cable,
    startingVersion: number,
    onTransactionBatch: (batch: ServerTransaction[]) => void
  ) {
    const transactionQueue = new ReceivedTransactionQueue(
      startingVersion,
      onTransactionBatch
    );

    this.channel = cable.subscriptions.create(
      {
        channel: "Collab::DocumentChannel",
        startingVersion,
        ...params,
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

    this.channel.perform("submit", data);
  }
}
