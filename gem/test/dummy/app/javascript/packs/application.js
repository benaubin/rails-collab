import ActionCable from "actioncable";
import "core-js/stable";
import { exampleSetup } from "prosemirror-example-setup";
import "prosemirror-example-setup/style/style.css";
import "prosemirror-menu/style/menu.css";
import { schema } from "prosemirror-schema-basic";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import "prosemirror-view/style/prosemirror.css";
import { railsCollab } from "rails-collab";
import "regenerator-runtime/runtime";

const cable = ActionCable.createConsumer();

function loadEditor() {
  const editors = document.querySelectorAll("[data-collaborative-editor]");

  for (const editorEl of editors) {
    const data = JSON.parse(editorEl.dataset.collaborativeEditor);

    new EditorView(editorEl, {
      state: EditorState.create({
        doc: schema.nodeFromJSON(data.content),
        plugins: [
          ...exampleSetup({ schema }),
          railsCollab({
            cable,
            startingVersion: data.version,
            params: { document_id: data.id },
            throttleMs: 250,
          }),
        ],
      }),
    });
  }
}
addEventListener("load", loadEditor);
