class DocumentClient < ApplicationRecord
  has_tracked_document_range :selection
end
