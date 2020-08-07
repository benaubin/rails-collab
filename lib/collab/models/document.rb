module Collab
  class Models::Document < ::Collab::Models::Base
    belongs_to :attached, polymorphic: true

    with_options foreign_key: :document_id do
      has_many :commits,           class_name: ::Collab.config.commit_model
      has_many :tracked_positions, class_name: ::Collab.config.tracked_position_model
    end

    validates :content, presence: true
    validates :document_version, presence: true, numericality: {only_integer: true, greater_than_or_equal_to: 0}
    validates :schema_name, presence: true

    after_save :delete_old_commits

    # Serialize the document to html, uses cached if possible.
    # Note that this may lock the document
    def to_html
      return serialized_html if serialized_html

      serialized_version = self.document_version
      ::Collab::JS.document_to_html(self.content, schema_name: schema_name).tap do |serialized_html|
        Thread.new do # use a thread to prevent deadlocks and avoid incuring the cost of an inline-write
          self.with_lock do
            self.update_attribute(:serialized_html, serialized_html) if serialized_version == self.document_version and self.serialized_html.nil?
          end
        end
      end
    end

    def apply_commit(data)
      base_version = data["v"]&.to_i
      steps = data["steps"]

      return false unless base_version
      return false unless steps.is_a?(Array) && !steps.empty?

      self.with_lock do
        return false unless self.possibly_saved_version? base_version

        self.document_version += 1

        original_positions = self.tracked_positions.current.distinct.pluck(:pos, :assoc).map { |(pos, assoc)| {pos: pos, assoc: assoc} }
        
        result = ::Collab::JS.apply_commit content,
                                          {steps: steps},
                                           map_steps_through: self.commits.where("document_version > ?", base_version).steps,
                                           pos: original_positions,
                                           schema_name: schema_name

        self.content = result["doc"]

        commits.create!({
          steps: result["steps"],
          ref: data["ref"],
          document_version: self.document_version
        })

        self.save!

        original_positions.lazy.zip(result["pos"]) do |original, res|
          if res["deleted"]
            tracked_positions.current.where(original).update_all deleted_at_version: self.document_version
          elsif original[:pos] != res["pos"]
            tracked_positions.current.where(original).update_all pos: res["pos"]
          end
        end
      end

    end

    def from_html(html)
      self.content = ::Collab::JS.html_to_document(html, schema_name: schema_name)
    end

    def as_json
      {id: id, content: content, version: document_version}
    end

    def content_will_change!
      super
      self.serialized_html = nil
    end

    def possibly_saved_version?(version)
      self.document_version >= version && self.oldest_saved_commit_version <= version
    end

    def oldest_saved_commit_version
      v = document_version - ::Collab.config.max_commit_history_length
      v > 0 ? v : 0
    end

    def resolve_positions(*positions, **kwargs, &block)
      ::Collab.config.tracked_position_model.constantize.resolve(self, *positions, **kwargs, &block)
    end
    alias :resolve_position :resolve_positions

    def resolve_selection(anchor_pos, head_pos, version:, &block)
      ::Collab::DocumentSelection.resolve(self, anchor_pos, head_pos, version: version, &block)
    end

    private

    def delete_old_commits
      return if oldest_saved_commit_version == 0
      commits.where("document_version < ?", oldest_saved_commit_version).delete_all
    end
  end
end