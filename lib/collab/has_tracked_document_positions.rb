module Collab
  module HasTrackedDocumentPositions
    extend ActiveSupport::Concern

    class_methods do
      def has_tracked_document_position(pos_name, optional: true)
        has_one   pos_name.to_sym, -> { where(name: pos_name) }, class_name: ::Collab.config.tracked_position_model, as: :owner, dependent: :destroy, autosave: true
        validates pos_name.to_sym, presence: !optional

        define_method :"#{pos_name}=" do |pos|
          pos.name = pos_name
          super(pos)
        end
      end

      def has_tracked_document_selection(selection_name)
        has_tracked_document_position :"#{selection_name}_anchor"
        has_tracked_document_position :"#{selection_name}_head"

        define_method selection_name do
          anchor = self.send(:"#{selection_name}_anchor")
          head   = self.send(:"#{selection_name}_head")

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
