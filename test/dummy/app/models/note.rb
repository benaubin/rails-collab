class Note < ApplicationRecord
  has_collaborative_document :body, schema: "schema", blank_document: {"type"=>"doc", "content"=>[{"type"=>"paragraph"}]}
end
