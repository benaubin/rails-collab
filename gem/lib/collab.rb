require "collab/engine"

module Collab
  def self.config
    if block_given?
      yield(@config ||= Collab::Config.new)
    else
      raise "[Collab] Missing configuration: Have you run `rails g collab:install` yet?" unless @config
      @config.freeze unless @config.frozen?
      @config
    end
  end

  autoload "Channel", "collab/channel"
  autoload "Config", "collab/config"
  autoload "Bridge", "collab/bridge"
  autoload "HasCollaborativeDocument", "collab/has_collaborative_document"
  
  module Models
    autoload "Base", "collab/models/base"
    autoload "Document", "collab/models/document"
    autoload "Commit", "collab/models/commit"
  end
end
