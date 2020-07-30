import { Step } from "prosemirror-transform";
import {
  Node,
  DOMParser as ProsemirrorDOMParser,
  DOMSerializer as ProsemirrorDOMSerializer,
} from "prosemirror-model";
import type { Schema } from "prosemirror-model";
import { JSDOM } from "jsdom";

export type JSONSerializable = { [key: string]: unknown };

interface TransactionData extends JSONSerializable {
  steps: JSONSerializable[];
}

const { document } = new JSDOM().window;

export default function schemaFunctions<S extends Schema>(schema: S) {
  function _applyTransaction(doc: Node<S>, transactionData: TransactionData) {
    for (const stepData of transactionData.steps) {
      const step = Step.fromJSON(schema, stepData);
      const result = step.apply(doc);

      if (result.failed) return false;
      if (result.doc) doc = result.doc;
    }

    return { doc };
  }

  return {
    applyTransaction({
      doc,
      data,
    }: {
      doc: JSONSerializable;
      data: TransactionData;
    }): JSONSerializable | false {
      const originalDoc = Node.fromJSON(schema, doc);

      const res = _applyTransaction(originalDoc, data);
      if (res === false) return false;

      return { doc: res.doc.toJSON() };
    },

    htmlToDoc(html: string): JSONSerializable {
      const parser = ProsemirrorDOMParser.fromSchema(schema);
      const doc = parser.parse(JSDOM.fragment(html));
      return doc.toJSON();
    },

    docToHtml(docRaw: JSONSerializable): string {
      const doc = Node.fromJSON(schema, docRaw);
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
