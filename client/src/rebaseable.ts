import type { Step, Transform } from "prosemirror-transform";
import type { Schema, Node } from "prosemirror-model";
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

/**
 * Rebase steps over a transaction
 *
 * Rebasing must only occur at the start of transactions. However, you may rebase over another rebase.
 * In other words, you must not call rebaseSteps() after applying a step to the given transform, but
 * you may call rebaseSteps() inside the callback of rebaseSteps().
 *
 * @param tr The transaction which will be used
 * @param steps The steps to rebase (they will be undone at the start of the transaction and redone at the end of the transaction)
 * @param over A function which will be called synchronously after undoing but before redoing the given steps.
 */
export function rebaseSteps<S extends Schema>(
  tr: Transaction<S>,
  steps: Rebaseable<S>[],
  over: () => void
): Rebaseable<S>[] {
  // Support interop with prosemirror-history
  const rebased = tr.getMeta("rebased") || 0;
  if (rebased !== tr.steps.length)
    throw new Error(
      "Attempted to rebase, but non-rebased steps were already applied to this transaction."
    );
  tr.setMeta("rebased", rebased + steps.length);

  // undo all steps
  for (let i = steps.length - 1; i >= 0; i--) tr.step(steps[i].inverted);

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
