module Collab
  class Models::Commit < ::Collab::Models::Base
    belongs_to :document, class_name: ::Collab.config.document_model

    validates :steps, length: { in: 0..10, allow_nil: false }
    validates :document_version, presence: true, numericality: {only_integer: true, greater_than_or_equal_to: 0}
    validates :ref, length: { maximum: 36 }, if: :ref

    after_create_commit :broadcast

    def steps
      super || []
    end

    def broadcast
      ::Collab.config.channel.constantize.broadcast_to(document, {
        "v" => document_version,
        "steps" => steps,
        "ref" => ref
      })
    end

    def self.steps
      pluck(:steps).flatten(1)
    end
  end
end
