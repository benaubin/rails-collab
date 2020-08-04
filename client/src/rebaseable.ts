import type { Step, Transform } from "prosemirror-transform";
import type { Schema, Node } from "prosemirror-model";
import forEachRight from "lodash/forEachRight";
import { Transaction } from "prosemirror-state";

export class Rebaseable<S extends Schema = Schema> {
  step: Step<S>;
  priorDoc: Node<S>;

  constructor(step: Step<S>, priorDoc: Node<S>) {
    this.step = step;
    this.priorDoc = priorDoc;
  }

  get inverted() {
    return this.step.invert(this.priorDoc);
  }
}

const notUndefined = <T>(val?: T): val is T => typeof val !== "undefined";

// Based on prosemirror-collab's function of the same name
// Undo a given set of steps, apply a set of other steps, and then redo them.
// This only really works well in real-time editing (someone needs to catch conflicts)
export function rebaseSteps<S extends Schema>(
  tr: Transaction<S>,
  steps: Rebaseable<S>[],
  over: () => void
): Rebaseable<S>[] {
  const rebased = tr.getMeta("rebased") || 0;
  if (rebased !== tr.steps.length)
    throw new Error("cannot rebase in a transaction that already started ");
  tr.setMeta("rebased", rebased + steps.length);

  // undo all steps
  forEachRight(steps, ({ inverted }) => tr.step(inverted));
  const indexOfLastUndo = tr.steps.length - 1;

  over();

  return steps
    .map(({ step }, i) => {
      const indexOfUndo = indexOfLastUndo - i;
      const indexOfRedo = tr.steps.length;
      const docBeforeRedo = tr.doc;

      const mappingThruRebase = tr.mapping.slice(indexOfUndo + 1);

      step = step.map(mappingThruRebase)!;
      if (step == null || tr.maybeStep(step).failed) return;

      (tr.mapping as any).setMirror(indexOfUndo, indexOfRedo);

      return new Rebaseable(step, docBeforeRedo);
    })
    .filter(notUndefined);
}

export function transformToRebaseable(transform: Transform): Rebaseable[] {
  return transform.steps.map(
    (step, i) => new Rebaseable(step, transform.docs[i])
  );
}
