import type { Cable } from "actioncable";
import type { Schema, Node } from "prosemirror-model";
import { Plugin, EditorState } from "prosemirror-state";
import type { PluginSpec } from "prosemirror-state";
import { Mapping } from "prosemirror-transform";
import { InflightCommit } from "./inflight-commit";
import { SubscriptionParams } from "./connection";
import { pluginKey as key } from "./plugin-key";
import { Rebaseable, transformToRebaseable } from "./rebaseable";
import CollabSession, { isSynced } from "./session";

export interface PluginState<S extends Schema = Schema> {
  localSteps: Rebaseable<S>[];

  inflightCommit?: InflightCommit<S>;

  lastSyncedDoc: Node<S>;

  /** a list of mappings for each version, in reverse order.
   *
   * versionMappings[i] = mapping from (syncedVersion - i - 1) to (syncedVersion - i)
   * versionMappings[0] = mapping from (syncedVersion - 1) to (syncedVersion)
   * versionMappings[1] = mapping from (syncedVersion - 2) to (syncedVersion - 1)
   * versionMappings[2] = mapping from (syncedVersion - 3) to (syncedVersion - 2)
   * ...
   */
  versionMappings: Mapping[];

  unsyncedMapping: Mapping;

  syncedVersion: number;
  selectionNeedsSending?: boolean;
}

export interface CollabOptions {
  readonly params: SubscriptionParams;
  readonly startingVersion: number;
  readonly cable: Cable;
  readonly syncSelection?: boolean;
}

class RailsCollabPlugin<S extends Schema> extends Plugin<PluginState, S> {
  constructor(opts: CollabOptions) {
    super({
      key,
      state: {
        init: (_config, state) => ({
          localSteps: [],
          unsyncedMapping: new Mapping(),
          versionMappings: [],
          syncedVersion: opts.startingVersion,
          selectionNeedsSending: true,
          lastSyncedDoc: state.doc,
        }),
        apply(tr, oldState) {
          let state: PluginState | undefined = tr.getMeta(key);
          if (state == null) {
            state = { ...oldState };

            if (tr.docChanged) {
              state.unsyncedMapping = state.unsyncedMapping.slice(0);
              state.unsyncedMapping.appendMapping(tr.mapping);
              state.localSteps = state.localSteps.concat(
                transformToRebaseable(tr)
              );
            }
          }

          if (opts.syncSelection && tr.selectionSet)
            state.selectionNeedsSending = true;

          return state;
        },
      },
      view(view) {
        const session = new CollabSession(view, opts);

        return {
          update(_, oldState) {
            session.stateWasUpdated(oldState);
          },
          destroy() {
            session.destroy();
          },
        };
      },
      historyPreserveItems: true,
    } as PluginSpec<PluginState, S>);
  }

  isCollabSynced(state: EditorState<S>) {
    return isSynced(this.getState(state));
  }
}

export default function railsCollab<S extends Schema>(opts: CollabOptions) {
  return new RailsCollabPlugin<S>(opts);
}
