require "collab/railtie"

module Collab
  def self.config
    @config ||= Collab::Config.new
    return @config unless block_given?
    yield @config
  end

  autoload "Channel", "collab/channel"
  autoload "Config", "collab/config"
  autoload "Bridge", "collab/bridge"
  autoload "HasCollaborativeDocument", "collab/has_collaborative_document"
  
  module Models
    autoload "Base", "collab/models/base"
    autoload "Document", "collab/models/document"
    autoload "DocumentTransaction", "collab/models/document_transaction"
  end
end
