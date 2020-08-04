import type { Cable } from "actioncable";
import type { Schema } from "prosemirror-model";
import type { PluginSpec } from "prosemirror-state";
import { Plugin } from "prosemirror-state";
import throttle from "lodash/throttle";
import CollaborationConnection, { SubscriptionParams } from "./connection";
import { applyCommits, InflightCommit } from "./commits";
import { Rebaseable, transformToRebaseable } from "./rebaseable";
import pluginKey, { pluginKey as key } from "./plugin-key";

export interface PluginState<S extends Schema = Schema> {
  localSteps: Rebaseable<S>[];

  inflightCommit?: InflightCommit<S>;

  syncedVersion: number;
  selectionNeedsSending?: boolean;
}

export function railsCollab<S extends Schema>({
  params,
  startingVersion,
  cable,
  throttleMs = 2000,
  syncSelection,
}: {
  params: SubscriptionParams;
  startingVersion: number;
  cable: Cable;
  throttleMs?: number;
  syncSelection?: boolean;
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
      const connection = new CollaborationConnection(
        params,
        cable,
        startingVersion,
        (batch) => {
          view.dispatch(applyCommits(view.state, batch));
        }
      );

      const sync = throttle(
        () => {
          const pluginState: PluginState = pluginKey.getState(view.state);
          const commit = InflightCommit.fromState(view.state);

          if (commit) {
            connection.commit(commit.sendable());
          }

          const synced =
            commit == null &&
            pluginState.inflightCommit == null &&
            pluginState.localSteps.length == 0;

          if (pluginState.selectionNeedsSending) {
            if (synced) {
              connection.sendSelect({
                v: pluginState.syncedVersion,
                head: view.state.selection.head,
                anchor: view.state.selection.anchor,
              });
              pluginState.selectionNeedsSending = false;
            } else {
              sync(); // we'll send the selection later, once we're synced with the server.
            }
          }
        },
        throttleMs,
        {
          leading: false,
          trailing: true,
        }
      );

      const { dispatchTransaction } = view.props;
      view.props.dispatchTransaction = (tr) => {
        if (dispatchTransaction) dispatchTransaction.call(view, tr);
        else view.updateState(view.state.apply(tr));

        sync();
      };

      return {
        destroy() {
          connection.close();
        },
      };
    },
    historyPreserveItems: true,
  } as PluginSpec<PluginState, S>);
}
