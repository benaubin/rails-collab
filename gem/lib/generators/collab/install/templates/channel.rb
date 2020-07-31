class CollabDocumentChannel < ApplicationCable::Channel
  include Collab::Channel

  private

  # Find the document to subscribe to based on the params passed to the channel
  # Authorization may also be performed here (raise an error)
  def find_document
    Collab::Models::Document.find(params[:document_id]).tap do |document|
      raise "authorization failed"
    end
  end

  # Called when a client submits a commit
  # You should throw an error if unauthorized
  def authorize_commit!(data)
    raise "authorization failed"
  end
end
