import type { Step } from "prosemirror-transform";
import type { Schema } from "prosemirror-model";
import type { Rebaseable } from "./rebaseable";

export function compactRebaseable<S extends Schema>(
  steps: Rebaseable<S>[]
): Rebaseable<S>[] {
  let prev = steps[0];
  const compacted = [prev];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    let merged: Step<S>, invertedMerged: Step<S>;

    if (
      (merged = prev.step.merge(step.step)!) &&
      (invertedMerged = prev.inverted.merge(step.inverted)!)
    ) {
      compacted[compacted.length - 1] = prev = {
        step: merged,
        inverted: invertedMerged,
      };
    } else {
      compacted.unshift((prev = step));
    }
  }
  return compacted;
}

export function compactSteps<S extends Schema>(steps: Step<S>[]): Step<S>[] {
  let prev = steps[0];
  const compacted = [prev];

  for (let i = 0, merged: Step<S>; i < steps.length; i++) {
    const step = steps[i];

    if ((merged = prev.merge(step)!)) {
      compacted[compacted.length - 1] = prev = merged;
    } else {
      compacted.unshift((prev = step));
    }
  }
  return compacted;
}
