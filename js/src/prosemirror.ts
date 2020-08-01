import { Step } from "prosemirror-transform";
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

const { document } = new JSDOM().window;

export default function schemaFunctions<S extends Schema>(schema: S) {
  return {
    applyCommit(data: {
      doc: JSONSerializable;
      commit: CommitData;
    }): JSONSerializable | false {
      let doc = schema.nodeFromJSON(data.doc) as Node<S>;

      for (const stepData of data.commit.steps) {
        const step = Step.fromJSON(schema, stepData);
        const result = step.apply(doc);

        if (result.failed) return false;
        if (result.doc) doc = result.doc;
      }

      return { doc: doc.toJSON() };
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
