module Collab
  module HasCollaborativeDocument
    extend ActiveSupport::Concern
    
    class_methods do
      def has_collaborative_document(attach_as, schema:, blank_document:)
        has_one attach_as, -> { where(attached_as: attach_as) }, class_name: ::Collab.config.document_model, as: :attached

        define_method attach_as do
          super() || begin
            document = self.__send__("build_#{attach_as}", schema_name: schema, content: blank_document.dup)
            document.save!
            document
          end
        end
      end
    end
  end
end