module Collab
  module HasTrackedDocumentPositions
    extend ActiveSupport::Concern

    class_methods do
      def has_tracked_document_position(pos_name, optional: true)
        belongs_to pos_name.to_sym, class_name: ::Collab.config.tracked_position_model, optional: optional, counter_cache: :references
      end

      def has_tracked_document_selection(selection_name)
        has_tracked_document_position :"#{selection_name}_anchor"
        has_tracked_document_position :"#{selection_name}_head"

        define_method selection_name do
          anchor, head = ::Collab.config.tracked_position_model.constantize.find(self.send(:"#{selection_name}_anchor_id"), self.send(:"#{selection_name}_head_id"))
          ::Collab::DocumentSelection.new anchor, head
        end

        define_method :"#{selection_name}=" do |sel|
          self.send(:"#{selection_name}_anchor=", sel&.anchor)
          self.send(:"#{selection_name}_head=", sel&.head)
        end
      end
    end
  end
end
