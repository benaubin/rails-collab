require "rails/generators"
require "rails/generators/active_record"

module Collab
  class Install < Rails::Generators::NamedBase
    include ::Rails::Generators::Migration

    desc "Creates the necessary migrations and initializer for the gem"

    source_root File.expand_path('templates', __dir__)
  
    def copy_initializer_file
      migration_template(
        "create_collab_tables.rb",
        "db/migrate/create_collab_tables.rb",
      )
      
      copy_file "initializer.rb", "config/initializers/collab.rb"
    end
  end
end