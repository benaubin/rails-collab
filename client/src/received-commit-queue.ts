import type { CommitData } from "./network";

/** Reorders commits received out of order */
export default class ReceivedCommitQueue {
  private queue: {
    [version: number]: CommitData | undefined;
  } = {};

  nextVersion: number;
  onCommit: (commit: CommitData) => void;

  constructor(
    startingVersion: number,
    onCommit: ReceivedCommitQueue["onCommit"]
  ) {
    this.nextVersion = startingVersion + 1;
    this.onCommit = onCommit;
  }

  receive(commit: CommitData) {
    if (this.nextVersion > commit.v) return; // This is an old commit - ignore it.

    if (this.nextVersion === commit.v) {
      this.nextVersion++;
      this.onCommit(commit);

      // dequeue commits
      for (let c; (c = this.queue[this.nextVersion]); this.nextVersion++) {
        delete this.queue[this.nextVersion];
        this.onCommit(c);
      }
    } else {
      this.queue[commit.v] = commit; // Future commit, queue for later
    }
  }
}
