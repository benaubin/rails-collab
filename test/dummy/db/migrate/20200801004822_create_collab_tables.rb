class CreateCollabTables < ActiveRecord::Migration[6.0]
  def change
    create_table :collab_documents do |t|
      t.references :attached,      null: false, index: false, polymorphic: true
      t.string     :attached_as,   null: false

      t.index   [:attached_type, :attached_id, :attached_as], name: "index_collab_documents_on_attached"

      t.json   :content,          null: false
      t.string  :schema_name,      null: false
      t.integer :document_version, null: false, default: 0
      t.text    :serialized_html

      t.timestamps
    end

    create_table :collab_commits, id: false do |t|
      t.references :document, null: false, foreign_key: {to_table: :collab_documents}, index: false
      t.integer    :document_version, null: false
      t.index      [:document_id, :document_version], unique: true, order: {document_version: :asc}, name: "index_collab_commits"

      t.json   :steps, array: true, null: false
      t.string  :ref

      t.datetime :created_at, null: false
    end
  end
end
