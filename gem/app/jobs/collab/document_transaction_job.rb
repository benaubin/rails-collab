class Collab::DocumentTransactionJob < ::Collab.config.application_job.constantize
  queue_as ::Collab.config.queue_document_transaction_job_as

  def perform(document, data)
    document.apply_transaction_now(data)
  end
end
