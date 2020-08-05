import type { Cable } from "actioncable";
import type { Schema } from "prosemirror-model";
import type { PluginSpec } from "prosemirror-state";
import { Plugin } from "prosemirror-state";
import { SubscriptionParams } from "./connection";
import { applyCommits, InflightCommit } from "./commits";
import { Rebaseable, transformToRebaseable } from "./rebaseable";
import pluginKey, { pluginKey as key } from "./plugin-key";
import ReceivedCommitQueue from "./received-commit-queue";

export interface PluginState<S extends Schema = Schema> {
  localSteps: Rebaseable<S>[];

  inflightCommit?: InflightCommit<S>;

  syncedVersion: number;
  selectionNeedsSending?: boolean;
}

function isSynced(pluginState: PluginState) {
  return (
    pluginState.inflightCommit == null && pluginState.localSteps.length == 0
  );
}

export function railsCollab<S extends Schema>({
  params,
  startingVersion,
  cable,
  syncSelection,
  onSyncStatusChanged,
}: {
  params: SubscriptionParams;
  startingVersion: number;
  cable: Cable;
  syncSelection?: boolean;
  /**
   * Called when the editor has local changes, and again once those changes have been confirmed by the server.
   *
   * Useful for indictating "saved" satus to the user.
   */
  onSyncStatusChanged(synced: false | true): void;
}) {
  return new Plugin<PluginState, S>({
    key,
    state: {
      init: () => ({
        localSteps: [],
        syncedVersion: startingVersion,
        selectionNeedsSending: true,
      }),
      apply(tr, oldState) {
        let state = tr.getMeta(key);
        if (state == null) {
          state = { ...oldState };
          if (tr.docChanged)
            state.localSteps = state.localSteps.concat(
              transformToRebaseable(tr)
            );
        }

        if (syncSelection && tr.selectionSet)
          state.selectionNeedsSending = true;

        return state;
      },
    },
    view(view) {
      let selectionInflight = false;

      const transactionQueue = new ReceivedCommitQueue(
        startingVersion,
        (batch) => {
          view.dispatch(applyCommits(view.state, batch));
        }
      );

      const channel = cable.subscriptions.create(
        {
          channel: "CollabDocumentChannel",
          startingVersion,
          ...params,
        },
        {
          received: (data) => {
            if (data.ack === "select") {
              selectionInflight = false;
              if (pluginKey.getState(view.state).selectionNeedsSending)
                syncSelect();
            } else {
              transactionQueue.receive(data);
            }
          },
        }
      );

      let wasSynced = true;

      const syncSelect = () => {
        if (selectionInflight) return;

        const pluginState: PluginState = pluginKey.getState(view.state);

        if (isSynced(pluginState)) {
          channel.perform("select", {
            v: pluginState.syncedVersion,
            head: view.state.selection.head,
            anchor: view.state.selection.anchor,
          });
          pluginState.selectionNeedsSending = false;
        }
      };

      const { dispatchTransaction } = view.props;
      view.props.dispatchTransaction = (tr) => {
        if (dispatchTransaction) dispatchTransaction.call(view, tr);
        else view.updateState(view.state.apply(tr));

        const commit = InflightCommit.fromState(view.state);
        if (commit) channel.perform("commit", commit.sendable());

        const pluginState: PluginState = pluginKey.getState(view.state);
        if (pluginState.selectionNeedsSending) syncSelect();

        const synced = isSynced(pluginState);
        if (synced !== wasSynced) {
          onSyncStatusChanged(synced);
          wasSynced = synced;
        }
      };

      return {
        destroy() {
          channel.unsubscribe();
        },
      };
    },
    historyPreserveItems: true,
  } as PluginSpec<PluginState, S>);
}
