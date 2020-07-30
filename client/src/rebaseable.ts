import { Step, Transform } from "prosemirror-transform";
import { Schema } from "prosemirror-model";
export { rebaseSteps } from "prosemirror-collab";

export interface Rebaseable<S extends Schema = Schema> {
  step: Step<S>;
  inverted: Step<S>;
  origin: Transform;
}

declare module "prosemirror-collab" {
  export function rebaseSteps<S extends Schema>(
    steps: Rebaseable<S>[],
    over: Step<S>[],
    transform: Transform<S>
  ): Rebaseable<S>[];
}

export function transformToRebaseable(transform: Transform): Rebaseable[] {
  return transform.steps.map((step, i) => ({
    step,
    inverted: step.invert(transform.docs[i]),
    origin: transform,
  }));
}
