import { rebaseSteps } from "./rebaseable";
import { Schema } from "prosemirror-model";
import { EditorState, TextSelection, Transaction } from "prosemirror-state";
import { Step } from "prosemirror-transform";
import key from "./plugin-key";
import type { ServerTransaction } from "./connection";
import type { PluginState } from "./plugin";

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

export function applyReceivedTransactions<S extends Schema>(
  editorState: EditorState<S>,
  received: ServerTransaction[]
): Transaction<S> {
  const [tr, { inflight, localSteps }, pluginState] = makeTransaction(
    editorState
  );

  tr.setMeta("addToHistory", false);

  pluginState.syncedVersion += received.length;

  if (inflight) {
    // our transaction is no longer going to be inflight - either because it was confirmed or someone else got their transaction in first
    pluginState.inflight = undefined;

    // due to symantics, we can only have one transaction inflight at a time, and only the first transaction we receive could be ours
    if (inflight.ref == received[0].ref) {
      // no need to process the transaction - this is confirmation is was received
      if (received.length == 1) return tr;
      else received.unshift();
    } else {
      // uh oh, our transaction wasn't processed and is no longer inflight, move to local
      pluginState.localSteps = inflight.steps.concat(localSteps);
    }
  }

  const receivedSteps = received.reduce<Step<S>[]>(
    (arr, { steps }) =>
      arr.concat(steps.map((step) => Step.fromJSON(editorState.schema, step))),
    []
  );

  pluginState.localSteps = rebaseSteps(localSteps, receivedSteps, tr);

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
 * Readys steps for sending
 *
 * @return `false` if a transaction is already inflight
 * @returns `null` if no steps need sending
 * @returns `[transaction, sendable]` use the first transaction to update the editor state (to mark steps inflight), and send the second to the server
 */
export function readyStepsForSending<S extends Schema>(
  editorState: EditorState<S>
): [Transaction<S>, ServerTransaction] | false | null {
  const [
    tr,
    { localSteps, inflight, syncedVersion },
    pluginState,
  ] = makeTransaction(editorState);

  if (inflight) return false;
  if (localSteps.length === 0) return null;

  const ref = randomRef();

  const sendableSteps: Step<S>[] = [];
  let prevStep = localSteps[0].step;

  for (let i = 1; i < localSteps.length; i++) {
    const step = localSteps[i].step;
    const merged = prevStep.merge(step);
    if (merged) {
      prevStep = merged;
    } else {
      sendableSteps.push(prevStep);
      prevStep = step;
    }
  }

  sendableSteps.push(prevStep);

  const sendable = {
    v: syncedVersion + 1,
    steps: sendableSteps.map((s) => s.toJSON()),
    ref,
  };

  pluginState.inflight = {
    steps: localSteps,
    ref,
  };
  pluginState.localSteps = [];

  return [tr, sendable];
}
