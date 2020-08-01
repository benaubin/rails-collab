module Collab
  class Models::Commit < ::Collab::Models::Base
    belongs_to :document, class_name: ::Collab.config.document_model

    validates :steps, presence: true
    validates :document_version, presence: true
    validates :ref, length: { maximum: 36 }

    after_create_commit :broadcast

    def self.from_json(data, include_root = false)
      new(document_version: data["v"]&.to_i, steps: data["steps"], ref: data["ref"])
    end

    def as_json(_opts = nil)
      {
        "v" => document_version,
        "steps" => steps,
        "ref" => ref
      }
    end

    def applies_to_current_document_version?
      self.document.document_version == (self.document_version - 1)
    end

    def apply_later
      raise "cannot apply persisted commit" if self.persisted?
      self.validate!
      return false unless self.applies_to_current_document_version?

      ::Collab.config.commit_job.constantize.perform_later(self.document, as_json)
    end

    def apply!
      raise "cannot apply persisted commit" if self.persisted?
      self.validate!
      return false unless self.applies_to_current_document_version? # optimization, prevents need to apply lock if outdated

      self.document.with_lock do
        return false unless self.applies_to_current_document_version?
        
        return false unless result = ::Collab::JS.apply_commit(self.document.content, self.as_json, schema_name: self.document.schema_name)
        
        self.document.content = result["doc"]
        self.document.document_version = self.document_version
        
        self.document.save!
        self.save!
      end
    end

    def broadcast
      ::Collab.config.channel.constantize.broadcast_to(document, as_json)
    end
  end
end
