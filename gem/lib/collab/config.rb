module Collab
  module Config
    class <<self
      attr_accessor :schema_package
      def schema_package
        @schema_package || "prosemirror-schema-basic"
      end
    end
  end
end
