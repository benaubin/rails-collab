import type { Cable } from "actioncable";
import type { Schema } from "prosemirror-model";
import type { PluginSpec } from "prosemirror-state";
import { Plugin } from "prosemirror-state";
import throttle from "lodash/throttle";
import CollaborationConnection, { SubscriptionParams } from "./connection";
import { applyCommits, makeCommit } from "./transactions";
import { Rebaseable, transformToRebaseable } from "./rebaseable";
import { pluginKey as key } from "./plugin-key";

/**
 * A neat interface with a super cool sounding name.
 *
 * Tracks all commits currently inflight, mapped to the number of unconfirmedSteps it contains (pre-merging)
 */
interface CommitFlightMap {
  [ref: string]: number | undefined;
}

export interface PluginState<S extends Schema = Schema> {
  localSteps: Rebaseable<S>[];
  inflightSteps: Rebaseable<S>[];
  /** Map ref to number of steps in commit */
  inflightCommits: CommitFlightMap;
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
      init: () => ({
        localSteps: [],
        inflightSteps: [],
        inflightCommits: {},
        syncedVersion: startingVersion,
      }),
      apply(tr, pluginState) {
        const newState = tr.getMeta(key);
        if (newState) return newState;

        if (tr.docChanged) {
          return {
            ...pluginState,
            inflightSteps: pluginState.inflightSteps.concat(
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
          view.dispatch(applyCommits(view.state, batch));
        }
      );

      const sendSteps = throttle(
        () => {
          const commit = makeCommit(view.state);
          if (!commit) return;
          connection.commit(commit);
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
