import {
  rebaseSteps,
  compactRebaseable,
  transformToRebaseable,
} from "../src/rebaseable";
import { EditorState } from "prosemirror-state";
import { schema, doc, p } from "prosemirror-test-builder";

describe(rebaseSteps, () => {
  test("throws an error when not used at the start of a transaction", () => {
    const originalDoc = doc(p("This is a test<a> document<sentenceEnd>."));

    const { a, sentenceEnd } = originalDoc.tag;

    const state = EditorState.create({
      schema,
      doc: originalDoc,
    });

    const tr1 = state.tr;
    tr1.insertText("Hi! ", 0);
    const state1 = state.apply(tr1);
    const rebaseable = transformToRebaseable(tr1);

    const tr2 = state.tr;
    tr2.insertText("", 0, 3);
    expect(() => {
      rebaseSteps(tr2, rebaseable, () => {});
    }).toThrow();
  });
});

describe(compactRebaseable, () => {
  test("gives an empty list when given an empty list", () => {
    expect(compactRebaseable([])).toStrictEqual([]);
  });

  test("merges a set of rebaseable steps", () => {
    const originalDoc = doc(p("This is a <a>test<b> document<sentenceEnd>."));

    const { a, b, sentenceEnd } = originalDoc.tag;

    const state = EditorState.create({
      schema,
      doc: originalDoc,
    });

    const tr = state.tr;

    tr.insertText("at", 2, 3);
    tr.insertText("", a, b);
    tr.insertText("changed", a);
    tr.insertText("; the steps cannot be fully merged", sentenceEnd);

    const rebaseable = transformToRebaseable(tr);
    expect(rebaseable).toHaveLength(4);

    const compacted = compactRebaseable(rebaseable);

    expect(compacted.map(({ step }) => step.toJSON())).toEqual([
      {
        stepType: "replace",
        from: 2,
        to: 3,
        slice: {
          content: [{ type: "text", text: "at" }],
        },
      },
      {
        stepType: "replace",
        from: a,
        to: b,
        slice: {
          content: [{ type: "text", text: "changed" }],
        },
      },
      {
        stepType: "replace",
        from: 24,
        to: 24,
        slice: {
          content: [
            { type: "text", text: "; the steps cannot be fully merged" },
          ],
        },
      },
    ]);
  });
});
