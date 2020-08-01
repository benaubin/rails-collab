//= require rails-ujs
//= require activestorage

import "core-js/stable";
import "regenerator-runtime/runtime";

import { EditorView } from "prosemirror-view";
import "prosemirror-view/style/prosemirror.css";
import { EditorState } from "prosemirror-state";
import { railsCollab } from "rails-collab";
import { schema } from "prosemirror-schema-basic";
import ActionCable from "actioncable";

const cable = ActionCable.createConsumer();

function loadEditor() {
  const editors = document.querySelectorAll("[data-collaborative-editor]");

  for (const editorEl of editors) {
    const data = JSON.parse(editorEl.dataset.collaborativeEditor);

    const view = new EditorView(editorEl, {
      state: EditorState.create({
        doc: schema.nodeFromJSON(data.content),
        plugins: [
          railsCollab({
            cable,
            startingVersion: data.version,
            params: { document_id: data.id },
          }),
        ],
      }),
    });
  }
}

addEventListener("turbolinks:load", () => {
  loadEditor();

  // addEventListener("turbolinks:before-render", function beforeRender() {
  //   removeEventListener("turbolinks:before-render", beforeRender);
  //   view.destroy();
  // });
});

addEventListener("load", loadEditor);
