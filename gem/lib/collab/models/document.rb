module Collab
  class Models::Document < ::Collab::Models::Base
    belongs_to :attached, polymorphic: true
    has_many :commits, class_name: ::Collab.config.commit_model, foreign_key: :document_id

    validates :content, presence: true
    validates :document_version, presence: true, numericality: {only_integer: true, greater_than_or_equal_to: 0}
    validates :schema_name, presence: true

    after_save :delete_old_commits

    # Serialize the document to html, uses cached if possible.
    # Note that this may lock the document
    def to_html
      return serialized_html if serialized_html

      serialized_version = self.document_version
      ::Collab::Bridge.current.document_to_html(self.content, schema_name: schema_name).tap do |serialized_html|
        Thread.new do # use a thread to prevent deadlocks and avoid incuring the cost of an inline-write
          self.with_lock do
            self.update_attribute(:serialized_html, serialized_html) if serialized_version == self.version and self.serialized_html.nil?
          end
        end
      end
    end

    def from_html(html)
      self.content = ::Collab::Bridge.current.html_to_document(html, schema_name: schema_name)
    end

    def commit_later(data)
      commits.from_json(data).apply_later
    end

    def as_json
      {id: id, content: content, version: document_version}
    end

    def content_will_change!
      super
      self.serialized_html = nil
    end

    private

    def delete_old_commits
      cutoff = document_version - ::Collab.config.max_commit_history_length
      return if cutoff <= 0
      commits.where("document_version < ?", cutoff).delete_all
    end
  end
end