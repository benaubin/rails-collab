import type { Step } from "prosemirror-transform";
import type { Schema } from "prosemirror-model";
import type { Rebaseable } from "./rebaseable";

type MergedStep<S extends Schema> = Step<S> | null | undefined;

export function compactRebaseable<S extends Schema>(
  steps: Rebaseable<S>[]
): Rebaseable<S>[] {
  const compacted = [steps[0]];

  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    const prev = compacted[compacted.length - 1];

    let merged: MergedStep<S>, invertedMerged: MergedStep<S>;

    if (
      (merged = prev.step.merge(step.step)) &&
      (invertedMerged = prev.inverted.merge(step.inverted))
    ) {
      compacted[compacted.length - 1] = {
        step: merged,
        inverted: invertedMerged,
      };
    } else {
      compacted.push(step);
    }
  }
  return compacted;
}

export function compactSteps<S extends Schema>(steps: Step<S>[]): Step<S>[] {
  const compacted = [steps[0]];

  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];

    let merged = steps[compacted.length - 1].merge(step);

    if (merged) {
      compacted[compacted.length - 1] = merged;
    } else {
      compacted.push(step);
    }
  }
  return compacted;
}
