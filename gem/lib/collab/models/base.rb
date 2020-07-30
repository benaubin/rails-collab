module Collab
  class Models::Base < ::Collab.config.application_record.constantize
    self.abstract_class = true
    self.table_name_prefix = 'collab_'
  end
end