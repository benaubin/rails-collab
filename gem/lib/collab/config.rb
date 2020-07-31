module Collab
  class Config
    attr_accessor :max_transactions, :application_job, :queue_document_transaction_job_as, :schema_package, :application_record, :document_transaction_model, :document_model, :channel_name
  end
end
