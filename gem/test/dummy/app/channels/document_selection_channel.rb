class DocumentSelectionChannel < ApplicationCable::Channel
  def subscribed
    @document = Collab::Models::Document.find(params[:document_id])
    stream_for @document

    @document.with_lock("FOR SHARE") do
      DocumentClient.where(document: @document).each do |dc|
        transmit({
          v: @document.document_version,
          client_id: dc.id,
          head: dc.selection.head&.pos,
          anchor: dc.selection.anchor&.pos
        })
      end
    end
  end
end
