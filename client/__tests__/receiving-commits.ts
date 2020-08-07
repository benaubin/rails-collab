import { InflightCommit } from "../src/inflight-commit";
import { EditorState } from "prosemirror-state";
import { schema, doc, p } from "prosemirror-test-builder";
import { railsCollab } from "../src";
import { CollabNetworkAdapter } from "../src/network";
import { receiveCommitTransaction } from "../src/receive-commit";
import { Step } from "prosemirror-transform";
import pluginKey from "../src/plugin-key";
import { Rebaseable } from "../src/rebaseable";

const testNetwork: CollabNetworkAdapter = {
  async connect(startingVersion, callbacks) {
    return {
      commit() {},
      async sendSelect() {},
      disconnect() {},
    };
  },
};

describe(receiveCommitTransaction, () => {
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

  const commitData = {
    v: 1,
    ref: "",
    steps: [
      {
        stepType: "replace",
        from: wordEnd,
        to: wordEnd,
        slice: { content: [{ text: "ed", type: "text" }] },
      },
    ],
  };

  const commitSteps = commitData.steps.map((stepData) =>
    Step.fromJSON(schema, stepData)
  );

  test("receiving a single commit on the original document", () => {
    const tr = receiveCommitTransaction(state, commitData);

    expect(tr.steps).toEqual(commitSteps);
    expect(tr.doc).toEqual(doc(p("Tested document")));
    expect(tr.getMeta(pluginKey).syncedVersion).toBe(1);

    expect(tr.getMeta(pluginKey).lastSyncedDoc).toEqual(
      doc(p("Tested document"))
    );
  });

  test("receiving an unrelated commit on the original document while commit inflight", () => {
    const tr1 = state.tr;
    tr1.insertText("!", sentenceEnd);

    const stateWithInflightCommit = state.apply(tr1);
    const originalInflightCommit = InflightCommit.fromState(
      stateWithInflightCommit
    );
    if (!originalInflightCommit) fail();

    const tr2 = receiveCommitTransaction(stateWithInflightCommit, commitData);

    expect(tr2.steps).toHaveLength(3);

    expect(tr2.docs[1]).toEqual(doc(p("Test document")));
    expect(tr2.steps[1]).toEqual(commitSteps[0]);
    expect(tr2.docs[2]).toEqual(doc(p("Tested document")));

    expect(tr2.doc).toEqual(doc(p("Tested document!")));

    expect(tr2.getMeta(pluginKey).inflightCommit).toEqual(
      new InflightCommit(
        [new Rebaseable(tr2.steps[2], tr2.docs[2])],
        1,
        originalInflightCommit.ref
      )
    );

    expect(tr2.getMeta(pluginKey).lastSyncedDoc).toEqual(
      doc(p("Tested document"))
    );
  });

  test("receiving an commit confirmation", () => {
    const tr1 = state.tr;
    tr1.insertText("!", sentenceEnd);

    const state1 = state.apply(tr1);
    const inflightCommit = InflightCommit.fromState(state1);
    if (!inflightCommit) fail();

    const sendable = inflightCommit.sendable();
    const received = { ...sendable, v: 1 };

    const tr2 = receiveCommitTransaction(state1, received);
    expect(tr2.steps).toHaveLength(0);

    expect(tr2.doc).toEqual(doc(p("Test document!")));

    expect(tr2.getMeta(pluginKey).inflightCommit).toBeUndefined();

    expect(tr2.getMeta(pluginKey).lastSyncedDoc).toEqual(
      doc(p("Test document!"))
    );
    expect(tr2.getMeta(pluginKey).lastSyncedDoc).toBe(state1.doc);
  });

  test("receiving an commit confirmation with local steps", () => {
    const tr1 = state.tr;
    tr1.insertText("!", sentenceEnd);

    const state1 = state.apply(tr1);
    const inflightCommit = InflightCommit.fromState(state1);
    if (!inflightCommit) fail();

    const sendable = inflightCommit.sendable();
    const received = { ...sendable, v: 1 };

    const tr2 = state1.tr;

    tr2.insertText(" Now with local changes.", sentenceEnd + 1);

    const state2 = state1.apply(tr2);

    const tr3 = receiveCommitTransaction(state2, received);
    expect(tr3.steps).toHaveLength(0);

    expect(tr3.doc).toEqual(doc(p("Test document! Now with local changes.")));

    expect(tr3.getMeta(pluginKey).inflightCommit).toBeUndefined();

    expect(tr3.getMeta(pluginKey).lastSyncedDoc).toEqual(
      doc(p("Test document!"))
    );
    expect(tr3.getMeta(pluginKey).lastSyncedDoc).toBe(state1.doc);
  });

  test("receiving an commit on the original document while commit inflight & local changes", () => {
    const tr1 = state.tr;
    tr1.insertText("!", sentenceEnd);

    const stateWithInflightCommit = state.apply(tr1);
    const originalInflightCommit = InflightCommit.fromState(
      stateWithInflightCommit
    );
    if (!originalInflightCommit) fail();

    const tr2 = stateWithInflightCommit.tr;

    tr2.insertText("doc", wordEnd + 1, sentenceEnd);
    tr2.insertText("Great", 0, wordEnd);

    const stateWithLocalChanges = stateWithInflightCommit.apply(tr2);

    const tr3 = receiveCommitTransaction(stateWithLocalChanges, commitData);

    expect(tr3.docs[0]).toEqual(doc(p("Great doc!")));
    expect(tr3.docs[1]).toEqual(doc(p("Test doc!")));
    expect(tr3.docs[2]).toEqual(doc(p("Test document!")));
    expect(tr3.docs[3]).toEqual(doc(p("Test document")));
    expect(tr3.steps[3]).toEqual(commitSteps[0]);
    expect(tr3.docs[4]).toEqual(doc(p("Tested document")));
    expect(tr3.docs[5]).toEqual(doc(p("Tested document!")));
    expect(tr3.docs[6]).toEqual(doc(p("Tested doc!")));
    expect(tr3.doc).toEqual(doc(p("Greated doc!")));
    expect(tr3.steps).toHaveLength(7);

    expect(tr3.getMeta(pluginKey).inflightCommit).toEqual(
      new InflightCommit(
        [new Rebaseable(tr3.steps[4], tr3.docs[4])],
        1,
        originalInflightCommit.ref
      )
    );

    expect(tr3.getMeta(pluginKey).lastSyncedDoc).toEqual(
      doc(p("Tested document"))
    );

    expect(tr3.getMeta(pluginKey).localSteps).toEqual([
      new Rebaseable(tr3.steps[5], tr3.docs[5]),
      new Rebaseable(tr3.steps[6], tr3.docs[6]),
    ]);
  });
});
