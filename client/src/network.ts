import ReceivedCommitQueue from "./received-commit-queue";

export interface CommitData {
  v: number;
  steps: { [k: string]: unknown }[];
  ref?: string | null;
  ack?: never;
}

export interface SelectionData {
  v: number;
  head: number;
  anchor: number;
}

export interface NetworkCallbacks {
  onDisconnect(unrecoverable: boolean | Error): void;
  /** Call once a commit is received */
  onReceivedCommit(data: CommitData): void;
}

export interface CollabNetworkConnection {
  /** Send a commit to the server */
  commit(data: CommitData): void;

  /**
   * Send selection data to the server, returns a promise that resolves after ACK.
   *
   * May return false if temporarily not allowed and should be retried later.
   * For example, if the adapter only allows one in-flight select at a time.
   */
  sendSelect(data: SelectionData): false | Promise<void>;

  /** Disconnect from the server, will call onDisconnect() after disconnect */
  disconnect(): void;
}

export interface CollabNetworkAdapter<
  A extends CollabNetworkConnection = CollabNetworkConnection
> {
  connect(startingVersion: number, callbacks: NetworkCallbacks): Promise<A>;
}

interface SessionCallbacks {
  onClose(e?: Error): void;
  processCommit(commit: CommitData): void;
  getSendableCommit: () => undefined | CommitData;
  getSendableSelection: () => undefined | SelectionData;
}

/**
 * Adds reliability to network adapters used for collaboration
 *
 * (auto-reconnect, throttling, etc)
 */
export class CollabSession {
  private shouldReconnect = true;

  private network: CollabNetworkAdapter;

  connection?: CollabNetworkConnection;
  private connectionPromise: Promise<CollabNetworkConnection | undefined>;

  private callbacks: SessionCallbacks;

  private commitQueue: ReceivedCommitQueue;

  isConnected(): this is this & {
    connection: CollabNetworkConnection;
  } {
    return typeof this.connection !== "undefined";
  }

  selectionThrottleMS: number;
  commitThrottleMs: number;

  constructor(
    network: CollabNetworkAdapter,
    startingVersion: number,
    callbacks: SessionCallbacks,
    opts: {
      selectionThrottleMS: number;
      commitThrottleMs: number;
    }
  ) {
    this.network = network;
    this.callbacks = callbacks;

    this.commitQueue = new ReceivedCommitQueue(startingVersion, (commit) => {
      callbacks.processCommit(commit);
    });

    this.connectionPromise = this.connect();

    this.commitThrottleMs = opts.commitThrottleMs;
    this.selectionThrottleMS = opts.selectionThrottleMS;
  }

  async connect() {
    try {
      return this.network.connect(this.commitQueue.nextVersion - 1, {
        onDisconnect: (unrecoverable) => {
          this.connection = undefined;
          if (this.shouldReconnect && !unrecoverable) {
            this.connectionPromise = this.connect();
          } else {
            this.connectionPromise = undefined as never;
            this.callbacks.onClose(
              unrecoverable
                ? unrecoverable === true
                  ? new Error("Unrecoverable connection disconnect")
                  : unrecoverable
                : undefined
            );
          }
        },
        onReceivedCommit: (c) => this.commitQueue.receive(c),
      });
    } catch (e) {
      this.callbacks.onClose(e);
    }
  }

  private selectScheduled = false;

  sendSelection(): Promise<void> | undefined {
    if (this.selectScheduled) return;
    this.selectScheduled = true;

    return new Promise((res) => {
      setTimeout(async () => {
        this.selectScheduled = false;

        const sendableSelect = this.callbacks.getSendableSelection();
        if (sendableSelect) this.connection?.sendSelect(sendableSelect);

        res();
      }, this.selectionThrottleMS);
    });
  }

  private commitScheduled = false;

  commit() {
    if (this.commitScheduled) return;
    this.commitScheduled = true;

    setTimeout(() => {
      this.commitScheduled = false;

      if (!this.isConnected()) return this.commit();

      const sendableCommit = this.callbacks.getSendableCommit();
      if (sendableCommit) this.connection.commit(sendableCommit);
    }, this.commitThrottleMs);
  }

  close() {
    this.shouldReconnect = false;
    this.connectionPromise.then((c) => c?.disconnect());
  }
}
