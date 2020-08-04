module Collab
  # Represents a position in the document which is tracked between commits
  # 
  # If the position is deleted through mapping, deleted_at_version will be set, the position will
  # no longer be tracked,
  #
  class Models::TrackedPosition < ::Collab::Models::Base
    belongs_to :document, class_name: ::Collab.config.document_model

    validates :pos, presence: true, numericality: {only_integer: true, greater_than_or_equal_to: 0}
    validates :assoc, presence: true, inclusion: {in: [-1, 1]}, numericality: {only_integer: true}

    validates :deleted_at_version, numericality: {only_integer: true, greater_than_or_equal_to: 0}, if: :deleted_at_version

    scope :current, -> { where(deleted_at_version: nil) }

    # Resolves a set of positions and yields them to the block given, returning the result of the block
    # The document will be locked IN SHARE MODE during resolution and the block execution
    # Positions should consist of {"pos" => number, "assoc": number}
    # Returns false if invalid version or any position has been deleted
    def self.resolve(document, *positions, version:)
      raise false unless document.possibly_saved_version? version

      document.transaction do
        document.lock! "IN SHARE MODE"
      
        unless document.document_version == version 
          steps = document.commits.where("document_version > ?", @mapped_to).order(document_version: :asc).pluck(:steps).flatten(1)

          map_results = ::Collab::JS.map_through(steps: steps, pos: positions)["pos"]

          map_results.each_with_index do |r, i|
            return false if r["deleted"]
            positions[i]["pos"] = r["pos"]
          end
        end

        positions.map! do |p|
          document.tracked_positions.current.find_or_initialize_by(pos: p["pos"], assoc: p["assoc"])
        end

        yield(*positions)
      end
    end

    def referenced?
      references == 0
    end
  end
end
