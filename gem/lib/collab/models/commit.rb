module Collab
  class Models::Commit < ::Collab::Models::Base
    belongs_to :document, class_name: ::Collab.config.document_model

    validates :steps, presence: true
    validates :document_version, presence: true
    validates :ref, length: { maximum: 36 }

    after_create_commit :broadcast

    def self.from_json(data)
      new(document_version: data["v"]&.to_i, steps: data["steps"], ref: data["ref"])
    end

    def as_json
      {
        v: document_version,
        steps: steps,
        ref: ref
      }
    end

    def apply_later
      raise "cannot apply persisted commit" if self.persisted?
      raise "commit not valid" unless self.valid?
      return false if self.document.document_version != self.document_version

      ::Collab.config.commit_job.constantize.perform_later(self.document, as_json)
    end

    def apply!
      raise "cannot apply persisted commit" if self.persisted?
      raise "commit not valid" unless self.valid?
      return false if self.document.document_version != self.document_version # optimization, prevents need to apply lock if outdated

      self.document.with_lock do
        return false if self.document.document_version != self.document_version
        
        return false unless result = ::Collab::Bridge.current.apply_commit(self.document, self.to_json, schema_name: self.document.schema_name)
        
        self.document.document = result["doc"]
        self.document.document_version = self.document_version
        
        self.document.save!
        self.save!
      end
    end

    def broadcast
      ::Collab.config.channel_name.constantize.broadcast_to(document, as_json)
    end
  end
end
