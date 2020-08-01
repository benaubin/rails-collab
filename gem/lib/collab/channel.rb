module Collab
  module Channel
    def subscribed
      @document = find_document
  
      starting_version = params[:startingVersion]&.to_i
      raise "missing startingVersion" if starting_version.nil?

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
      @document.commit_later(data)
    end

    def unsubscribed
      stop_all_streams # this may not be needed
    end
  end
end
