class CreateTrackedPositions < ActiveRecord::Migration[6.0]
  def change
    create_table :collab_tracked_positions do |t|
      t.references :document, null: false, foreign_key: {to_table: :collab_documents}, index: false
      t.references :owner, null: false, polymorphic: true, index: false
      t.string     :name, null: false
      
      t.integer    :pos,   null: false
      t.integer    :assoc, null: false, default: 1
      t.integer    :deleted_at_version

      t.index      [:document_id, :deleted_at_version, :pos], name: "index_collab_tracked_positions_on_document_pos"
      t.index      [:owner_type, :name, :owner_id], name: "index_collab_tracked_positions_on_owner"
    end
  end
end
