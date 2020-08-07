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

import { collabPlus, isSynced } from "prosemirror-collab-plus";

const cable = ActionCable.createConsumer();

function loadEditor() {
  const editors = document.querySelectorAll("[data-collaborative-editor]");

  for (const editorEl of editors) {
    const data = JSON.parse(editorEl.dataset.collaborativeEditor);

    const collab = collabPlus(railsCollab(cable, { document_id: data.id }), {
      startingVersion: data.version,
    });

    new EditorView(editorEl, {
      state: EditorState.create({
        doc: schema.nodeFromJSON(data.content),
        plugins: [...exampleSetup({ schema }), collab, ,],
      }),
      dispatchTransaction(tr) {
        const newState = this.state.apply(tr);
        this.updateState(newState);

        const synced = isSynced(collab.getState(newState));

        document.getElementById("save-status").innerText = synced
          ? "Saved"
          : "Saving...";
      },
    });
  }
}
addEventListener("load", loadEditor);
