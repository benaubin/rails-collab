import type { Cable } from "actioncable";
import type { Schema } from "prosemirror-model";
import throttle from "lodash/throttle";
import { Plugin, PluginSpec } from "prosemirror-state";
import CollaborationConnection, { SubscriptionParams } from "./connection";
import {
  applyReceivedTransactions,
  readyStepsForSending,
} from "./transactions";
import { Rebaseable, transformToRebaseable } from "./rebaseable";
import { pluginKey as key } from "./plugin-key";

export interface PluginState<S extends Schema = Schema> {
  localSteps: Rebaseable<S>[];
  inflight?: {
    steps: Rebaseable<S>[];
    ref: string;
  };
  syncedVersion: number;
}

export function railsCollab<S extends Schema>({
  params,
  startingVersion,
  cable,
  throttleMs = 2000,
}: {
  params: SubscriptionParams;
  startingVersion: number;
  cable: Cable;
  throttleMs?: number;
}) {
  return new Plugin<PluginState, S>({
    key,
    state: {
      init: () => ({ localSteps: [], syncedVersion: startingVersion }),
      apply(tr, pluginState) {
        const newState = tr.getMeta(key);
        if (newState) return newState;

        if (tr.docChanged) {
          return {
            ...pluginState,
            localSteps: pluginState.localSteps.concat(
              transformToRebaseable(tr)
            ),
          };
        }
        return pluginState;
      },
    },
    view(view) {
      const connection = new CollaborationConnection(
        params,
        cable,
        startingVersion,
        (batch) => {
          view.dispatch(applyReceivedTransactions(view.state, batch));
        }
      );

      const sendSteps = throttle(
        () => {
          const ready = readyStepsForSending(view.state);
          if (!ready) return;
          const [tr, sendable] = ready;

          view.dispatch(tr);
          connection.submitTransaction(sendable);
        },
        throttleMs,
        {
          leading: false,
          trailing: true,
        }
      );

      const { dispatch } = view;
      view.dispatch = (tr) => {
        dispatch(tr);
        sendSteps();
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
