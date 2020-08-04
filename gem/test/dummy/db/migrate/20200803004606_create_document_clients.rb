class CreateDocumentClients < ActiveRecord::Migration[6.0]
  def change
    create_table :document_clients do |t|
      t.references :selection_head,   null: true, foreign_key: {to_table: :collab_tracked_positions}
      t.references :selection_anchor, null: true, foreign_key: {to_table: :collab_tracked_positions}
      
      t.string :name

      t.timestamps
    end
  end
end
