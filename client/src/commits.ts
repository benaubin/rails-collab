import type { Schema } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";
import { TextSelection } from "prosemirror-state";
import { Step } from "prosemirror-transform";
import flatMap from "lodash/flatMap";
import { compactRebaseable, compactSteps } from "./compact-steps";
import type { Commit } from "./connection";
import type { PluginState } from "./plugin";
import key from "./plugin-key";
import { rebaseSteps } from "./rebaseable";

function randomRef() {
  const bytes = new Uint32Array(2);
  window.crypto.getRandomValues(bytes);
  return bytes.reduce((str, byte) => str + byte.toString(36), "");
}

/** a helper function to make a transaction which will modify the plugin state */
function makeTransaction<S extends Schema>(editorState: EditorState<S>) {
  const tr = editorState.tr;
  const pluginState: PluginState<S> = key.getState(editorState);
  const nextPluginState = { ...pluginState };
  tr.setMeta(key, nextPluginState);
  return [tr, pluginState, nextPluginState] as const;
}

export function applyCommits<S extends Schema>(
  editorState: EditorState<S>,
  commits: Commit[]
): Transaction<S> {
  const [tr, { inflightCommits }, newState] = makeTransaction(editorState);

  tr.setMeta("addToHistory", false);

  newState.syncedVersion += commits.length;
  newState.inflightCommits = {}; // all inflight commits were either confirmed or rejected (bad version)

  const { ref } = commits[0]; // only the first commit could be from this client as other commits refer to a newer version of the document
  const commitStepsLen = ref == null ? undefined : inflightCommits[ref];
  if (typeof commitStepsLen !== "undefined") {
    newState.inflightSteps = newState.inflightSteps.slice(commitStepsLen);
    commits.shift();
  }

  const remoteSteps = flatMap(commits, ({ steps }) =>
    steps.map((step) => Step.fromJSON(editorState.schema, step))
  );

  if (newState.inflightSteps.length == 0) {
    for (const step of remoteSteps) tr.step(step);
  } else {
    newState.inflightSteps = rebaseSteps(
      newState.inflightSteps,
      remoteSteps,
      tr
    );
  }

  // prosemirror-collab's mapselectionbackward
  tr.setSelection(
    TextSelection.between(
      tr.doc.resolve(tr.mapping.map(editorState.selection.anchor, -1)),
      tr.doc.resolve(tr.mapping.map(editorState.selection.head, -1)),
      -1
    )
  );
  ((tr as unknown) as { updated: number }).updated &= ~1; // this was part of prosemirror-collab's mapselectionbackward, not sure what it does though

  return tr;
}

/**
 * Makes a commit out of steps available for sending
 */
export function makeCommit<S extends Schema>(
  editorState: EditorState<S>
): Commit | undefined {
  const pluginState: PluginState<S> = key.getState(editorState);

  if (pluginState.localSteps.length > 0) {
    const compactedSteps = compactRebaseable(pluginState.localSteps);
    pluginState.inflightSteps = pluginState.inflightSteps.concat(
      compactedSteps
    );
    pluginState.localSteps = [];
  }

  const { inflightSteps } = pluginState;

  if (inflightSteps.length === 0) return;

  const ref = randomRef();
  pluginState.inflightCommits[ref] = inflightSteps.length;

  const compactedSteps = compactSteps(inflightSteps.map(({ step }) => step));

  return {
    v: pluginState.syncedVersion + 1,
    steps: compactedSteps.map((s) => s.toJSON()),
    ref,
  };
}
