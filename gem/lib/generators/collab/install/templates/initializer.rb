# Configuration for the collab gem
Collab.config do |c|
  # The NPM package containing the document schema
  c.schema_package = "prosemirror-schema-basic"
  # How many old transactions to keep per document
  c.max_transactions = 250

  # Handlers
  # ========
  # Find a the document to subscribe to based on the params passed to the channel
  # Authorization may also be performed here (raise an error)
  # The block is executed in the scope of the ActionCable channel within #subscribe
  c.find_document_for_subscribe do
    Collab::Models::Document.find params[:document_id]
  end
  # Called when a client submits a transaction in order to update a document
  # You should throw an error if unauthorized
  # The block is executed in the instance of the channel
  c.authorize_update_document do |document, transaction_data|
    raise "unauthorization not implemented"
  end


  # ActionJob settings
  # ==================
  # The base job class to use
  c.application_job = "::ApplicationJob"
  # The job queue to use for DocumentTransaction jobs
  c.queue_document_transaction_job_as = :default


  # ActiveRecord settings
  # =====================
  # The class which models in the gem should inherit from
  c.application_record = "::ApplicationRecord"
  # If you want to use your own document model or document transaction model, 
  c.document_model = "::Collab::Models::Document"
  c.document_transaction_model = "::Collab::Models::DocumentTransaction"
end
