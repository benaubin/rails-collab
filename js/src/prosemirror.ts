import { Step, Transform, Mapping } from "prosemirror-transform";
import type { Node } from "prosemirror-model";
import {
  DOMParser as ProsemirrorDOMParser,
  DOMSerializer as ProsemirrorDOMSerializer,
} from "prosemirror-model";
import type { Schema } from "prosemirror-model";
import { JSDOM } from "jsdom";

export type JSONSerializable = { [key: string]: unknown };

interface CommitData extends JSONSerializable {
  steps: JSONSerializable[];
}

interface TrackedPosition extends JSONSerializable {
  pos: number;
  assoc: -1 | 1;
}

const { document } = new JSDOM().window;

export default function schemaFunctions<S extends Schema>(schema: S) {
  return {
    applyCommit(data: {
      doc: JSONSerializable;
      commit: CommitData;
      mapStepsThrough: JSONSerializable[];
      pos?: TrackedPosition[];
    }): JSONSerializable {
      const mapping = new Mapping(
        data.mapStepsThrough.map((stepData) =>
          Step.fromJSON(schema, stepData).getMap()
        )
      );

      const original = schema.nodeFromJSON(data.doc);
      const tr = new Transform(original);

      const succeededSteps = data.commit.steps.filter((stepData) => {
        const step = Step.fromJSON(schema, stepData).map(mapping);
        if (step == null) return false;
        const res = tr.maybeStep(step);
        return !res.failed;
      });

      return {
        doc: tr.doc.toJSON(),
        steps: succeededSteps,
        pos: data.pos?.map(({ pos, assoc }) =>
          tr.mapping.mapResult(pos, assoc)
        ),
      };
    },

    mapThru(data: { steps: JSONSerializable[]; pos: TrackedPosition[] }) {
      const mapping = new Mapping(
        data.steps.map((step) => Step.fromJSON(schema, step).getMap())
      );

      return {
        pos: data.pos.map(({ pos, assoc }) => mapping.mapResult(pos, assoc)),
      };
    },

    htmlToDoc(html: string): JSONSerializable {
      const parser = ProsemirrorDOMParser.fromSchema(schema);
      const doc = parser.parse(JSDOM.fragment(html));
      return doc.toJSON();
    },

    docToHtml(docRaw: JSONSerializable): string {
      const doc = schema.nodeFromJSON(docRaw) as Node<S>;
      const serializer = ProsemirrorDOMSerializer.fromSchema(schema);
      const domFragment = serializer.serializeFragment(doc.content, {
        document,
      }) as JSDOM["window"]["DocumentFragment"];

      const tempDiv = document.createElement("div");
      tempDiv.appendChild(domFragment);

      return tempDiv.innerHTML;
    },
  };
}
