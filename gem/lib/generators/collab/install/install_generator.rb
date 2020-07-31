require "rails/generators"
require "rails/generators/active_record"

module Collab
  class Install < Rails::Generators::Base
    include ::Rails::Generators::Migration

    desc "Creates the necessary migrations and initializer for the gem"
    source_root File.expand_path('templates', __dir__)
  
    class <<self
      # Implement the required interface for Rails::Generators::Migration.
      def next_migration_number(dirname)
        next_migration_number = current_migration_number(dirname) + 1
        ActiveRecord::Migration.next_migration_number(next_migration_number)
      end
    end

    def copy_files
      migration_template(
        "create_collab_tables.rb",
        "db/migrate/create_collab_tables.rb",
      )
      
      copy_file "channel.rb", "app/channels/collab_document_channel.rb"

      copy_file "initializer.rb", "config/initializers/collab.rb"
    end
  end
end