class DocumentClient < ApplicationRecord
  has_tracked_document_selection :selection
end
