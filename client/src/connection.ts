import type { Cable, Channel } from "actioncable";
import ReceivedCommitQueue from "./received-commit-queue";

export type Commit = {
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
  channel: Channel;

  constructor(
    /** Params passed to the cable and passed to find_document_for_subscribe. You can override channel here */
    params: SubscriptionParams,
    cable: Cable,
    startingVersion: number,
    onCommitBatch: (batch: Commit[]) => void
  ) {
    const transactionQueue = new ReceivedCommitQueue(
      startingVersion,
      onCommitBatch
    );

    this.channel = cable.subscriptions.create(
      {
        channel: "CollabDocumentChannel",
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
  commit(data: Commit) {
    this.channel.perform("commit", data);
  }
}
