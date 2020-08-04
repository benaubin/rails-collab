import type { Schema } from "prosemirror-model";
import { Rebaseable } from "./rebaseable";

export function compactRebaseable<S extends Schema>(
  steps: Rebaseable<S>[]
): Rebaseable<S>[] {
  let step = steps.shift();
  if (typeof step === "undefined") return [];

  const compacted = [step];
  while ((step = steps.shift())) {
    const prev = compacted[compacted.length - 1];

    let merged = prev.step.merge(step.step);

    if (merged) {
      compacted[compacted.length - 1] = new Rebaseable(merged, prev.priorDoc);
    } else {
      compacted.push(step);
    }
  }

  return compacted;
}
