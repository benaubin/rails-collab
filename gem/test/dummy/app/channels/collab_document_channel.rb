class CollabDocumentChannel < ApplicationCable::Channel
  include Collab::Channel

  def unsubscribed
    @document_client.destroy!
  end

  private

  def _select(selection)
    @document_client.update! selection: selection

    DocumentSelectionChannel.broadcast_to(@document, {
      v: @document.document_version,
      client_id: @document_client.id,
      head: @document_client.selection.head.pos,
      anchor: @document_client.selection.anchor.pos
    })
  end

  # Find the document to subscribe to based on the params passed to the channel
  # Authorization may also be performed here (raise an error to prevent subscription)
  def find_document
    Collab::Models::Document.find(params[:document_id]).tap do |d|
      @document_client = DocumentClient.create document: d
    end
  end

  # Called a commit is first received for processing
  # Throw an error to prevent the commit from being processed
  # You should consider adding some type of rate-limiting here
  def authorize_commit!(data)
    # no-op
  end
end
