class CreateDocumentClients < ActiveRecord::Migration[6.0]
  def change
    create_table :document_clients do |t|
      t.string :name
      t.references :document, foreign_key: {to_table: :collab_documents}, null: false

      t.timestamps
    end
  end
end
