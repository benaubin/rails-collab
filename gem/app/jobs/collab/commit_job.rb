class Collab::CommitJob < ::Collab.config.base_job.constantize
  queue_as :default

  def perform(document, data)
    document.commits.from_json(data).apply!
  end
end
