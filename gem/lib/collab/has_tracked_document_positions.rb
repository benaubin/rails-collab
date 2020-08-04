module Collab
  module HasTrackedDocumentPositions
    extend ActiveSupport::Concern

    class_methods do
      def has_tracked_document_position(pos_name, optional: true)
        belongs_to pos_name.to_sym, class_name: ::Collab.config.tracked_position_model, optional: optional, counter_cache: :references
      end

      def has_tracked_document_range(range_name)
        has_tracked_document_position :"#{range_name}_anchor"
        has_tracked_document_position :"#{range_name}_head"

        define_method range_name do
          ::Collab::Range.new self.send(:"#{range_name}_anchor"), self.send(:"#{range_name}_head")
        end

        define_method :"#{range_name}=" do |range|
          self.send(:"#{range_name}_anchor=", range&.anchor)
          self.send(:"#{range_name}_head=", range&.head)
        end
      end
    end
  end
end
