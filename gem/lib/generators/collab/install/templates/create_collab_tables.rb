class CreateCollabTables < ActiveRecord::Migration[6.0]
  def change
    create_table :collab_documents, id: :uuid do |t|
      t.references :attached, null: false, index: false, type: :uuid, polymorphic: true
      t.string :attached_as
      t.index [:attached_type, :attached_id, :attached_as], name: "index_collaborative_documents_on_attached"

      t.string :schema_name, null: false

      t.jsonb :document, null: false
      t.integer :document_version, null: false, default: 0

      t.text :serialized_html
      t.integer :serialized_html_version

      t.timestamps
    end

    create_table :collab_document_transactions, id: false do |t|
      t.references :document, null: false, foreign_key: {to_table: :collab_documents}, type: :uuid, index: false

      t.jsonb :steps, array: true, null: false
      t.integer :document_version, null: false

      t.string :ref

      t.index [:document_id, :document_version], unique: true, order: {document_version: :asc}, name: "index_collaborative_document_transactions"

      t.timestamps
    end
  end
end