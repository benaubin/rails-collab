require "collab/version"
require "collab/config"
require "collab/js"
require "collab/engine"

module Collab
  autoload "Channel", "collab/channel"
  autoload "HasCollaborativeDocument", "collab/has_collaborative_document"
  
  module Models
    autoload "Base", "collab/models/base"
    autoload "Document", "collab/models/document"
    autoload "Commit", "collab/models/commit"
  end
end
