import type { Schema } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";
import { CommitData } from "./connection";
import type { PluginState } from "./plugin";
import key from "./plugin-key";
import { Rebaseable, compactRebaseable } from "./rebaseable";

const maxStepsPerCommit = 10;

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
    state.localSteps = sendableSteps.splice(maxStepsPerCommit - 1);

    state.inflightCommit = new InflightCommit(
      sendableSteps,
      state.syncedVersion
    );

    return state.inflightCommit;
  }
}
