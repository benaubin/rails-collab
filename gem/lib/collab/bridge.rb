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
      @node = IO.popen(["node", File.expand_path('./js/dist/index.js', __dir__)], "r+")
    end

    def call(name, data = nil, schemaName:)
      req = {name: name, data: data, schemaPackage: Collab::Config.schema_package, schemaName: schemaName}
      @node.puts(JSON.generate(req))
      res = JSON.parse(@node.gets)
      raise JSRuntimeError.new(res["error"]) if res["error"]
      res["result"]
    end
  end
end
