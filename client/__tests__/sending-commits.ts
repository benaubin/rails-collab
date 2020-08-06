import { InflightCommit } from "../src/inflight-commit";
import { EditorState } from "prosemirror-state";
import { schema, doc, p } from "prosemirror-test-builder";
import { railsCollab } from "../src";
import { CollabNetworkAdapter } from "../src/network";

const testNetwork: CollabNetworkAdapter = {
  async connect(startingVersion, callbacks) {
    return {
      commit() {},
      async sendSelect() {},
      disconnect() {},
    };
  },
};

test("can be made from editor state", () => {
  const collab = railsCollab(testNetwork, {
    startingVersion: 0,
    onConnectionClose: () => {},
  });
  const originalDoc = doc(p("Test<wordEnd> document<sentenceEnd>"));
  const { wordEnd, sentenceEnd } = originalDoc.tag;
  const state = EditorState.create({
    schema,
    doc: originalDoc,
    plugins: [collab],
  });

  // a commit made when there are no steps should be undefined
  expect(InflightCommit.fromState(state)).toBeUndefined();

  const tr = state.tr;

  tr.insertText("e", wordEnd, wordEnd);
  tr.insertText("d", wordEnd + 1, wordEnd + 1);

  const changedState = state.apply(tr);

  const { localSteps } = collab.getState(changedState);
  const localStepsJSON = localSteps.map(({ step }) => step.toJSON());
  expect(localStepsJSON).toEqual([
    {
      stepType: "replace",
      from: wordEnd,
      to: wordEnd,
      slice: { content: [{ text: "e", type: "text" }] },
    },
    {
      stepType: "replace",
      from: wordEnd + 1,
      to: wordEnd + 1,
      slice: { content: [{ text: "d", type: "text" }] },
    },
  ]);

  expect(collab.getState(changedState).inflightCommit).not.toBeDefined();

  const commit = InflightCommit.fromState(changedState);
  if (!commit) return fail();

  expect(collab.getState(changedState).inflightCommit).toBe(commit);
  expect(collab.getState(changedState).localSteps).toHaveLength(0);

  const sendableCommit = commit.sendable();
  // we should be merging steps here
  expect(sendableCommit).toEqual({
    v: 0,
    ref: sendableCommit.ref,
    steps: [
      {
        stepType: "replace",
        from: wordEnd,
        to: wordEnd,
        slice: { content: [{ text: "ed", type: "text" }] },
      },
    ],
  });

  // a transaction made while a commit is inflight should be undefined.
  const tr2 = changedState.tr;
  tr2.insertText("!", tr.mapping.map(sentenceEnd));
  const changedStage2 = changedState.apply(tr2);
  expect(collab.getState(changedStage2).localSteps).toHaveLength(1);
  expect(InflightCommit.fromState(changedStage2)).toBeUndefined();
});
