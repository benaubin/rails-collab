module Collab
  module Channel
    def subscribed
      @document = find_document
  
      starting_version = params[:startingVersion]&.to_i
      raise "missing startingVersion" if starting_version.nil?
      raise "invalid version" unless @document.possibly_saved_version? (starting_version - 1)

      stream_for @document
      
      commits = @document.commits
                         .where("document_version > ?", starting_version)
                         .order(document_version: :asc)
                         .load
              
      unless commits.empty?
        raise "invalid version" unless commits.first.document_version == (starting_version + 1)
        commits.lazy.map(&:as_json).each(method(:transmit))
      end
    end

    def commit(data)
      authorize_commit!(data)
      @document.apply_commit(data)
    end

    def select(data)
      return unless defined?(_select)

      version    = data["v"]&.to_i
      anchor_pos = data["anchor"]&.to_i
      head_pos   = data["head"]&.to_i

      return unless version && @document.possibly_saved_version?(version) && anchor_pos && head_pos

      ::Collab::Range.resolve(@document, anchor_pos, head_pos, version: version) do |selection|
        _select selection
      end

      transmit({ack: "select"})
    end

    def unsubscribed
      stop_all_streams # this may not be needed
    end
  end
end
