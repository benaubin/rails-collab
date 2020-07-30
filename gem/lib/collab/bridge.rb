require "collab/config"
require "json"

module Collab
  class Bridge
    class JSRuntimeError < StandardError
      def initialize(data)
        @js_backtrace = data["stack"].split("\n").map{|f| "JavaScript #{f.strip}"} if data["stack"]

        super(data["name"] + ": " + data["message"])
      end

      def backtrace
        return unless  val = super
        
        if @js_backtrace
          @js_backtrace + val
        else
          val
        end
      end
    end
    
    def initialize
      @node = Dir.chdir(Rails.root) do
        IO.popen(["node", "-e", %q{"require('rails-collab-server')"}], "r+")
      end
    end

    def self.current
      @current ||= new
    end

    def call(name, data = nil, schemaName:)
      req = {name: name, data: data, schemaPackage: ::Collab.config.schema_package, schemaName: schemaName}
      @node.puts(JSON.generate(req))
      res = JSON.parse(@node.gets)
      raise ::Collab::Bridge::JSRuntimeError.new(res["error"]) if res["error"]
      res["result"]
    end
    
    def apply_transaction(document, transaction, schemaName:)
      call("applyTransaction", {doc: document, data: transaction}, schemaName: schemaName)
    end

    def html_to_document(html, schemaName:)
      call("htmlToDoc", html, schemaName: schemaName)
    end

    def document_to_html(document, schemaName:)
      call("docToHtml", document, schemaName: schemaName)
    end
  end
end
