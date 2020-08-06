import type { Node, Schema } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import type { PluginSpec } from "prosemirror-state";
import { Mapping } from "prosemirror-transform";
import { InflightCommit } from "./inflight-commit";
import { mapBackToSyncedVersion } from "./mapping";
import { CollabSession, CollabNetworkAdapter } from "./network";
import { pluginKey as key } from "./plugin-key";
import { Rebaseable, transformToRebaseable } from "./rebaseable";
import { receiveCommitTransaction } from "./receive-commit";

export function isSynced(pluginState: PluginState) {
  return (
    pluginState.inflightCommit == null && pluginState.localSteps.length == 0
  );
}

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
  readonly startingVersion: number;

  /** Whether to send the user's cursor selection to the server. If a number, throttle updates by milliseconds (default: 500ms) */
  readonly syncSelection?: boolean | number;

  /** How many miliseconds to throttle commit sending. (default: 200ms) */
  readonly commitThrottleMs: number;

  /** Called if the connection closes and cannot be recovered */
  readonly onConnectionClose: (e?: Error) => void;
}

class RailsCollabPlugin<S extends Schema> extends Plugin<PluginState, S> {
  constructor(network: CollabNetworkAdapter, opts: CollabOptions) {
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
        const session = new CollabSession(network, opts.startingVersion, {
          onClose: opts.onConnectionClose,
          processCommit(commit) {
            const tr = receiveCommitTransaction(view.state, commit);
            view.dispatch(tr);
          },
          getSendableCommit() {
            const inflightCommit = InflightCommit.fromState(view.state);
            if (inflightCommit) return inflightCommit.sendable();
          },
          getSendableSelection() {
            const pluginState = key.getState(view.state);
            const selection = mapBackToSyncedVersion(
              pluginState,
              view.state.selection
            );

            if (selection) {
              pluginState.selectionNeedsSending = false;
              return {
                v: pluginState.syncedVersion,
                head: selection.head,
                anchor: selection.anchor,
              };
            }
          },
        });

        const syncSelection: () => void = async () => {
          while (key.getState(view.state).selectionNeedsSending) {
            const syncPromise = session.sendSelection();
            if (!syncPromise) return;
            await syncPromise;
          }
        };

        return {
          update(_) {
            session.commit();
            syncSelection();
          },
          async destroy() {
            session.close();
          },
        };
      },
      historyPreserveItems: true,
    } as PluginSpec<PluginState, S>);
  }
}

export default function railsCollab<S extends Schema>(
  network: CollabNetworkAdapter,
  opts: CollabOptions
) {
  return new RailsCollabPlugin<S>(network, opts);
}
