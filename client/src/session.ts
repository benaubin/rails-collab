import type { Channel } from "actioncable";
import type { Schema } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";
import { receiveCommitTransaction } from "./receive-commit";
import { InflightCommit } from "./inflight-commit";
import { CommitData } from "./connection";
import { PluginState, CollabOptions } from "./plugin";
import pluginKey from "./plugin-key";
import ReceivedCommitQueue from "./received-commit-queue";
import { EditorState } from "prosemirror-state";
import { Mapping } from "prosemirror-transform";

export function isSynced(pluginState: PluginState) {
  return (
    pluginState.inflightCommit == null && pluginState.localSteps.length == 0
  );
}

export default class CollabSession<S extends Schema> {
  view: EditorView<S>;
  transactionQueue: ReceivedCommitQueue;
  selectionInflight = false;
  channel: Channel;
  commitThrottleMs: number;
  selectionThrottleMS: number;

  constructor(view: EditorView<S>, opts: CollabOptions) {
    this.view = view;

    this.commitThrottleMs = opts.commitThrottleMs || 200;
    this.selectionThrottleMS =
      typeof opts.syncSelection === "number" ? opts.syncSelection : 500;

    this.transactionQueue = new ReceivedCommitQueue(
      opts.startingVersion,
      (batch) => {
        for (const commit of batch) {
          const tr = receiveCommitTransaction(this.view.state, commit);
          this.view.dispatch(tr);
        }
      }
    );

    this.channel = opts.cable.subscriptions.create(
      {
        channel: "CollabDocumentChannel",
        startingVersion: opts.startingVersion,
        ...opts.params,
      },
      {
        received: this.onDataReceived.bind(this),
      }
    );
  }

  stateWasUpdated(_oldState: EditorState<S>) {
    this.commit();

    const pluginState: PluginState = pluginKey.getState(this.view.state);
    if (pluginState.selectionNeedsSending) this.syncSelect();
  }

  destroy() {
    this.channel.unsubscribe();
  }

  private onDataReceived(data: CommitData | { ack: "select" }) {
    if (data.ack === "select") {
      this.selectionInflight = false;

      if (pluginKey.getState(this.view.state).selectionNeedsSending)
        this.syncSelect();
    } else {
      this.transactionQueue.receive(data);
    }
  }

  private get pluginState(): PluginState<S> {
    return pluginKey.getState(this.view.state);
  }

  private commitScheduled = false;
  private commit() {
    if (this.commitScheduled) return;
    this.commitScheduled = true;

    window.setTimeout(() => {
      this.commitScheduled = false;

      const commit = InflightCommit.fromState(this.view.state);
      if (commit) this.channel.perform("commit", commit.sendable());
    }, this.commitThrottleMs);
  }

  private syncSelect() {
    if (this.selectionInflight) return;
    this.selectionInflight = true;

    setTimeout(() => {
      const reverseUnsyncedMapping = new Mapping();
      reverseUnsyncedMapping.appendMappingInverted(
        this.pluginState.unsyncedMapping
      );

      try {
        const selection = this.view.state.selection.map(
          this.pluginState.lastSyncedDoc,
          reverseUnsyncedMapping
        );

        this.channel.perform("select", {
          v: this.pluginState.syncedVersion,
          head: selection.head,
          anchor: selection.anchor,
        });

        this.pluginState.selectionNeedsSending = false;
      } catch (e) {
        if (e instanceof RangeError) {
          this.selectionInflight = false;
        } else throw e;
      }
    }, this.selectionThrottleMS);
  }
}
