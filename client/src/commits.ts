import type { Schema } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";
import { Step } from "prosemirror-transform";
import { compactRebaseable } from "./compact-steps";
import { CommitData } from "./connection";
import type { PluginState } from "./plugin";
import key from "./plugin-key";
import { Rebaseable, rebaseSteps } from "./rebaseable";

/** a helper function to make a transaction which will modify the plugin state */
function makeTransaction<S extends Schema>(editorState: EditorState<S>) {
  const tr = editorState.tr;
  const pluginState: PluginState<S> = key.getState(editorState);
  const nextPluginState = { ...pluginState };
  tr.setMeta(key, nextPluginState);
  return [tr, pluginState, nextPluginState] as const;
}

function applyCommitSteps<S extends Schema>(
  tr: Transaction<S>,
  schema: S,
  data: CommitData
) {
  for (const stepJSON of data.steps) {
    const step = Step.fromJSON(schema, stepJSON);
    tr.step(step);
  }
}

export function applyCommits<S extends Schema>(
  editorState: EditorState<S>,
  commits: CommitData[]
): Transaction<S> {
  const [tr, {}, state] = makeTransaction(editorState);

  tr.setMeta("addToHistory", false);
  state.syncedVersion += commits.length;

  state.localSteps = rebaseSteps(tr, state.localSteps, () => {
    if (state.inflightCommit) {
      // we have a commit inflight, so we need to be on the lookout for a confirmation of the commit
      let commit = commits.shift();
      if (commit == null) return;

      if (commit.ref === state.inflightCommit.ref) {
        state.inflightCommit = undefined;
      } else {
        // This gets a bit messy.
        // We have a commit inflight and we _may_ have received it in this batch of commits
        // we need to rebase the commit we have inflight over the commits the server accepted prior to the inflight commit
        // however, if we get confirmation of our inflight commit, finalize the rebase (redoing the inflight commit)

        let inflightConfirmed = false;
        const inflightRef = state.inflightCommit.ref;

        const rebasedSteps = rebaseSteps(tr, state.inflightCommit.steps, () => {
          while (commit) {
            applyCommitSteps(tr, editorState.schema, commit);

            commit = commits.shift();
            if (commit && commit.ref === inflightRef) {
              inflightConfirmed = true;
              return;
            }
          }
        });

        if (inflightConfirmed) {
          state.inflightCommit = undefined;
        } else {
          state.inflightCommit = new InflightCommit(
            rebasedSteps,
            state.syncedVersion,
            inflightRef
          );
        }
      }
    }

    for (const commit of commits)
      applyCommitSteps(tr, editorState.schema, commit);
  });

  return tr;
}

export class InflightCommit<S extends Schema> {
  readonly baseVersion: number;
  readonly steps: Rebaseable<S>[];
  readonly ref: string;

  constructor(
    steps: Rebaseable<S>[],
    baseVersion: number,
    ref = InflightCommit.randomRef()
  ) {
    this.baseVersion = baseVersion;
    this.steps = steps;
    this.ref = ref;
  }

  sendable(): CommitData {
    return {
      v: this.baseVersion,
      ref: this.ref,
      steps: this.steps.map((step) => step.step.toJSON()),
    };
  }

  static randomRef() {
    const bytes = new Uint32Array(2);
    window.crypto.getRandomValues(bytes);
    return bytes.reduce((str, byte) => str + byte.toString(36), "");
  }

  static fromState<S extends Schema>(
    editorState: EditorState<S>
  ): InflightCommit<S> | undefined {
    const state: PluginState<S> = key.getState(editorState);

    // we may only have one inflight commit at a time
    if (state.inflightCommit) return;
    if (state.localSteps.length === 0) return;

    const sendableSteps = compactRebaseable(state.localSteps);
    state.localSteps = sendableSteps.splice(9);

    state.inflightCommit = new InflightCommit(
      sendableSteps,
      state.syncedVersion
    );

    return state.inflightCommit;
  }
}
