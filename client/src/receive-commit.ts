import type { Schema } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";
import { Step, Mapping } from "prosemirror-transform";
import { CommitData } from "./connection";
import type { PluginState } from "./plugin";
import key from "./plugin-key";
import { rebaseSteps } from "./rebaseable";
import { InflightCommit } from "./inflight-commit";

function applyCommitSteps<S extends Schema>(
  tr: Transaction<S>,
  schema: S,
  data: CommitData
): Mapping {
  const mapping = new Mapping();
  for (const stepJSON of data.steps) {
    const step = Step.fromJSON(schema, stepJSON);
    tr.step(step);
    mapping.appendMap(step.getMap());
  }
  return mapping;
}

const maxVersionMappings = 100;

export function receiveCommitTransaction<S extends Schema>(
  editorState: EditorState<S>,
  commit: CommitData
): Transaction<S> {
  const tr = editorState.tr;
  const state: PluginState<S> = { ...key.getState(editorState) };

  tr.setMeta(key, state);
  tr.setMeta("addToHistory", false);

  let unsyncedMapping: Mapping = new Mapping();
  // The mapping for this commit from the previous commit
  let commitMapping: Mapping | undefined;

  state.syncedVersion += 1;

  state.localSteps = rebaseSteps(tr, state.localSteps, () => {
    if (state.inflightCommit) {
      if (commit.ref === state.inflightCommit.ref) {
        // We have a commit in flight and this is its confirmation
        commitMapping = new Mapping(
          state.inflightCommit.steps.map(({ step }) => step.getMap())
        );

        state.inflightCommit = undefined;
      } else {
        // We have a commit inflight, but we need to rebase it over the one we just received
        const rebasedSteps = rebaseSteps(tr, state.inflightCommit.steps, () => {
          commitMapping = applyCommitSteps(tr, editorState.schema, commit);
        });

        // Because the commit is still unsynced, we need to add its mapping to the unsyncedMapping
        for (const { step } of rebasedSteps)
          unsyncedMapping.appendMap(step.getMap());

        state.inflightCommit = new InflightCommit(
          rebasedSteps,
          state.syncedVersion,
          state.inflightCommit.ref
        );
      }
    } else {
      commitMapping = applyCommitSteps(tr, editorState.schema, commit);
    }
  });

  if (typeof commitMapping === "undefined")
    throw new Error("Collab: commitMapping undefined");

  for (const { step } of state.localSteps)
    unsyncedMapping.appendMap(step.getMap());

  state.versionMappings = state.versionMappings.slice(
    0,
    maxVersionMappings - 1
  );
  state.versionMappings.unshift(commitMapping);

  return tr;
}
