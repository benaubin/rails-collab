import type { Step, Transform } from "prosemirror-transform";
import type { Schema } from "prosemirror-model";
import forEachRight from "lodash/forEachRight";

export type Rebaseable<S extends Schema = Schema> = {
  step: Step<S>;
  inverted: Step<S>;
};

const notUndefined = <T>(val?: T): val is T => typeof val !== "undefined";

// Based on prosemirror-collab's function of the same name
// Undo a given set of steps, apply a set of other steps, and then redo them.
// This only really works well in real-time editing (someone needs to catch conflicts)
export function rebaseSteps<S extends Schema>(
  steps: Rebaseable<S>[],
  over: Step<S>[],
  transform: Transform<S>
): Rebaseable<S>[] {
  // undo all steps
  forEachRight(steps, ({ inverted }) => transform.step(inverted));
  const indexOfLastUndo = transform.steps.length - 1;

  // apply the new steps
  over.forEach((step) => transform.step(step));

  return steps
    .map(({ step }, i) => {
      const indexOfUndo = indexOfLastUndo - i;
      const indexOfRedo = transform.steps.length;
      const docBeforeRedo = transform.doc;

      const mappingThruRebase = transform.mapping.slice(indexOfUndo + 1);

      step = step.map(mappingThruRebase)!;
      if (step == null || transform.maybeStep(step).failed) return;

      (transform.mapping as any).setMirror(indexOfUndo, indexOfRedo);

      return {
        step,
        inverted: step.invert(docBeforeRedo),
      };
    })
    .filter(notUndefined);
}

export function transformToRebaseable(transform: Transform): Rebaseable[] {
  return transform.steps.map((step, i) => ({
    step,
    inverted: step.invert(transform.docs[i]),
  }));
}
