module Collab
  class Config
    attr_accessor :max_transactions, :application_job, :queue_document_transaction_job_as, :schema_package, :application_record, :document_transaction_model, :document_model
    
    def find_document_for_subscribe(&block)
      @find_document_for_subscribe unless block
      @find_document_for_subscribe = block
    end

    def authorize_update_document(&block)
      @authorize_update_document unless block
      @authorize_update_document = block
    end
  end
end
