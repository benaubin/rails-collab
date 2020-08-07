/**
 * @jest-environment jsdom
 */

import { EditorState } from "prosemirror-state";
import { doc, p } from "prosemirror-test-builder";
import { EditorView } from "prosemirror-view";
import { railsCollab } from "../src";
import { CollabNetworkAdapter, CommitData } from "../src/network";

jest.useFakeTimers();

const testNetwork: CollabNetworkAdapter & {
  commitCallbacks: ((data: CommitData) => void)[];
} = {
  commitCallbacks: [],
  async connect(startingVersion, callbacks) {
    testNetwork.commitCallbacks.push(callbacks.onReceivedCommit);
    return {
      commit: (data) => {
        for (const cb of testNetwork.commitCallbacks) {
          cb({ ...data, v: data.v + 1 });
        }
      },
      async sendSelect() {},
      disconnect() {},
    };
  },
};

(window as any).crypto = {
  getRandomValues(bytes: Uint32Array) {
    return require("crypto").randomBytes(bytes!.byteLength);
  },
} as any;

test("collaboration between multiple editors", async () => {
  const initialDoc = doc(p());

  const makeEditor = () =>
    new EditorView(undefined, {
      state: EditorState.create({
        doc: initialDoc,
        plugins: [
          railsCollab(testNetwork, {
            startingVersion: 0,
            onConnectionClose: () => {},
          }),
        ],
      }),
    });

  const editor1 = makeEditor();
  const editor2 = makeEditor();

  await (async () => {})(); // we need to await here in order to allow the network to connect

  const tr = editor1.state.tr;
  tr.insertText(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
  );
  editor1.dispatch(tr);

  jest.runOnlyPendingTimers();

  expect(editor1.state.doc).toEqual(editor2.state.doc);
});
