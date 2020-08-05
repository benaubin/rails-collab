class CreateDocumentClients < ActiveRecord::Migration[6.0]
  def change
    create_table :document_clients do |t|
      t.string :name

      t.timestamps
    end
  end
end
