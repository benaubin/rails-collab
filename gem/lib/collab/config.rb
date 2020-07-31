module Collab
  class Config
    attr_accessor :base_record,
                  :base_job,
                  :channel,
                  :max_commit_history_length,
                  :commit_job,
                  :commit_model,
                  :document_model,
                  :schema_package
  end
end
