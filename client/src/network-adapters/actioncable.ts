import {
  CollabNetworkAdapter,
  CollabNetworkConnection,
  NetworkCallbacks,
  CommitData,
  SelectionData,
} from "../network";

export interface ActionCableParams {
  channel: string;
  startingVersion: number;
  [k: string]: unknown;
}

export default function actionCableNetwork(
  cable: ActionCable.Cable,
  params: Partial<ActionCableParams>
): CollabNetworkAdapter<ActionCableConnection> {
  return {
    async connect(startingVersion, callbacks) {
      return new Promise((res, rej) => {
        const connection = new ActionCableConnection(
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

class ActionCableConnection implements CollabNetworkConnection {
  channel: ActionCable.Channel;

  ackSelectCallback?: () => void;
  rejSelectCallback?: () => void;

  constructor(
    cable: ActionCable.Cable,
    params: ActionCableParams,
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
      received: (data: CommitData | { ack: "select" }) => {
        if (data.ack === "select") {
          if (!this.ackSelectCallback)
            throw new Error("Collab: Got unexpected select ack");
          this.ackSelectCallback();
        } else {
          callbacks.onReceivedCommit(data);
        }
      },
    });
  }

  sendSelect(data: SelectionData) {
    if (this.ackSelectCallback) return false;

    return new Promise<void>((res, rej) => {
      this.ackSelectCallback = res;
      this.rejSelectCallback = rej;
      this.channel.perform("select", data);
    }).finally(() => {
      this.ackSelectCallback = undefined;
      this.rejSelectCallback = undefined;
    });
  }

  commit(data: CommitData) {
    this.channel.perform("commit", data);
  }

  disconnect() {
    this.channel.unsubscribe();
  }
}
