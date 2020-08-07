import type {
  CollabNetworkAdapter,
  CollabNetworkConnection,
  NetworkCallbacks,
  CommitData,
} from "prosemirror-collab-plus";

import type ActionCable from "actioncable";

export interface RailsCollabParams {
  channel: string;
  startingVersion: number;
  [k: string]: unknown;
}

export function railsCollab(
  cable: ActionCable.Cable,
  params: Partial<RailsCollabParams>
): CollabNetworkAdapter<RailsCollabConnection> {
  return {
    async connect(startingVersion, callbacks) {
      return new Promise((res, rej) => {
        const connection = new RailsCollabConnection(
          cable,
          { channel: "CollabDocumentChannel", startingVersion, ...params },
          callbacks,
          () => {
            res(connection);
          },
          rej
        );
      });
    },
  };
}

class RailsCollabConnection implements CollabNetworkConnection {
  channel: ActionCable.Channel;

  ackSelectCallback?: () => void;
  rejSelectCallback?: () => void;

  constructor(
    cable: ActionCable.Cable,
    params: RailsCollabParams,
    callbacks: NetworkCallbacks,
    onConnect: () => void,
    onReject: () => void
  ) {
    this.channel = cable.subscriptions.create(params, {
      connected: onConnect,
      rejected: onReject,
      disconnected: () => {
        if (this.rejSelectCallback) this.rejSelectCallback();

        callbacks.onDisconnect(false);
      },
      received: (data: CommitData) => {
        callbacks.onReceivedCommit(data);
      },
    });
  }

  commit(data: CommitData) {
    this.channel.perform("commit", data);
  }

  disconnect() {
    this.channel.unsubscribe();
  }
}
