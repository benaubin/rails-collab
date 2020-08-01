# Configuration for the collab gem
Collab.config do |c|
  # The NPM package containing the document schema. This will be require()d from your Rails directory
  # To use a Git repo, see https://docs.npmjs.com/files/package.json#git-urls-as-dependencies
  c.schema_package = "prosemirror-schema-basic"
  # How many old transactions to keep per document
  c.max_commit_history_length = 250
  # How many NodeJS child processes to run (shared among all threads)
  c.num_js_processes = 2

  # The document channel to use for collaboration
  # If you change this, you must pass the value as {channel: "[ChannelName]"} in the params from the ActionCable client
  c.channel = "CollabDocumentChannel"

  # The class which jobs in the gem should inherit from
  c.base_job = "ApplicationJob"
  # The jobs to use, if you want to implement your own jobs
  # c.commit_job = "..."

  # The class which models in the gem should inherit from
  c.base_record = "ApplicationRecord"
  # The models to use, if you want to implement your own models
  # c.document_model = "..."
  # c.commit_model = "..."
end
