module Collab
  class Models::Document < ::Collab::Models::Base
    belongs_to :attached, polymorphic: true
    has_many :transactions, class_name: ::Collab.config.document_transaction_model, foreign_key: :document_id

    validates :document, presence: true
    validates :document_version, presence: true, numericality: {only_integer: true, greater_than_or_equal_to: 0}
    validates :schema_name, presence: true

    before_save :nullify_serialized_html, unless: :serialized_html_fresh?
    after_save :delete_old_transactions

    # The already-serialized html version of this document
    def serialized_html
      return super if serialized_html_fresh?
    end

    def serialized_html_fresh?
      serialized_html_version == document_version
    end

    # Serialize the document to html - will be cached if possible (somewhat expensive)
    def to_html
      return serialized_html if serialized_html

      serialized_html = ::Collab::Bridge.current.document_to_html(self.document, schema_name: schema_name)
      self.update! serialized_html: serialized_html, serialized_html_version: document_version
      serialized_html
    end

    def from_html(html)
      raise "cannot override a persisted document" if self.persisted?
      
      self.document = ::Collab::Bridge.current.html_to_document(html, schema_name: schema_name)
    end

    def perform_transaction_later(data)
      ::Collab::DocumentTransactionJob.perform_later(@document, data)
    end

    def apply_transaction_now(data)
      return unless data["v"].is_a?(Integer)

      return if (data["v"] - 1) != self.document_version # if expired between queue and perform, there is no need to aquire a lock. this is an optimization - not a guarantee
      with_lock do
        return if (data["v"] - 1) != self.document_version # now that we've aquired a lock to the record, ensure that we're still accessing the correct version
        
        transaction_result = ::Collab::Bridge.current.apply_transaction(self.document, data, schema_name: self.schema_name)
        return unless transaction_result # check to make sure the transaction succeeded
        
        self.document = transaction_result["doc"]
        self.document_version = data["v"]
        save!

        transactions.create! document_version: self.document_version, steps: data["steps"], ref: data["ref"]
      end
    end

    private

    def nullify_serialized_html
      self.serialized_html = nil
    end

    def delete_old_transactions
      cutoff = document_version - ::Collab.config.max_transactions
      return if cutoff <= 0
      transactions.where("document_version < ?", cutoff).delete_all
    end
  end
end