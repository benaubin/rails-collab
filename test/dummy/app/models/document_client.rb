class DocumentClient < ApplicationRecord
  belongs_to :document, class_name: "Collab::Models::Document"

  has_tracked_document_selection :selection
end
