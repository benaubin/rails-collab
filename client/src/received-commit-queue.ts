import type { CommitData } from "./connection";

/** A class which handles re-ordering transactions sent out of order */
export default class ReceivedCommitQueue {
  queue: {
    [version: number]: CommitData | undefined;
  } = {};

  nextVersion: number;
  onBatch: (batch: CommitData[]) => void;

  constructor(startingVersion: number, onBatch: (batch: CommitData[]) => void) {
    this.nextVersion = startingVersion + 1;
    this.onBatch = onBatch;
  }

  receive(commit: CommitData) {
    if (this.nextVersion > commit.v) return; // This is an old commit - ignore it.

    if (this.nextVersion === commit.v) {
      const batch = [commit];
      this.nextVersion++;

      // dequeue commits
      for (let c; (c = this.queue[this.nextVersion]); this.nextVersion++) {
        batch.push(c);
        delete this.queue[this.nextVersion];
      }

      this.onBatch(batch);
    } else {
      this.queue[commit.v] = commit; // Future commit, queue for later
    }
  }
}
