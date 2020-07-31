module Collab
  class Models::DocumentTransaction < ::Collab::Models::Base
    belongs_to :document, class_name: ::Collab.config.document_model

    validates :steps, presence: true
    validates :document_version, presence: true

    after_create_commit :broadcast

    def as_json
      {
        v: document_version,
        steps: steps,
        ref: ref
      }
    end

    def broadcast
      ::Collab.config.channel_name.constantize.broadcast_to(document, as_json)
    end
  end
end
