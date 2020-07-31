import type { Step, Transform } from "prosemirror-transform";
import type { Schema } from "prosemirror-model";

export interface Rebaseable<S extends Schema = Schema> {
  step: Step<S>;
  inverted: Step<S>;
  origin: Transform;
}

// Based on prosemirror-collab's function of the same name
// Undo a given set of steps, apply a set of other steps, and then
// redo them.
export function rebaseSteps<S extends Schema>(
  steps: Rebaseable<S>[],
  over: Step<S>[],
  transform: Transform<S>
): Rebaseable<S>[] {
  for (let i = steps.length - 1; i >= 0; i--) transform.step(steps[i].inverted);
  for (const step of over) transform.step(step);

  return steps
    .map(({ step, origin }, i) => {
      const mapFrom = steps.length - i;
      let mapped = step.map(transform.mapping.slice(mapFrom));

      if (!mapped || transform.maybeStep(mapped).failed) return;

      (transform.mapping as any).setMirror(
        mapFrom - 1,
        transform.steps.length - 1
      );

      return {
        step: mapped,
        inverted: mapped.invert(transform.docs[transform.docs.length - 1]),
        origin: origin,
      };
    })
    .filter((a): a is NonNullable<typeof a> => typeof a !== "undefined");
}

export function transformToRebaseable(transform: Transform): Rebaseable[] {
  return transform.steps.map((step, i) => ({
    step,
    inverted: step.invert(transform.docs[i]),
    origin: transform,
  }));
}
