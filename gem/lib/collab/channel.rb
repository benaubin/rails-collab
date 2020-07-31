module Collab
  module Channel
    def document; @document end

    def subscribed
      @document = find_document

      starting_version = params[:startingVersion]&.to_i
      raise "missing startingVersion" if starting_version.nil?

      stream_for document
      
      transactions = document.transactions
                              .where("document_version > ?", starting_version)
                              .order(document_version: :asc)
                              .load
              
      raise "invalid version" unless transactions.first.document_version == (starting_version + 1) unless transactions.empty?

      transactions.lazy.map(&:as_json).each(method(:transmit))
    end

    def submit(data)
      authorize_submit!(data)
      document.perform_transaction_later(data)
    end

    def unsubscribed
      stop_all_streams # this may not be needed
    end
  end
end
