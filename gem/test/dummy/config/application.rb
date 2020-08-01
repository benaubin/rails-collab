require_relative 'boot'

require 'rails/all'

Bundler.require(*Rails.groups)

require "webpacker" # ensure webpacker (a dev-dependency for the gem) is always required
require "collab"

module Dummy
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 6.0
    
    config.action_cable.allowed_request_origins = [/http:\/\/*/, /https:\/\/*/]


    # Settings in config/environments/* take precedence over those specified here.
    # Application configuration can go into files in config/initializers
    # -- all .rb files in that directory are automatically loaded after loading
    # the framework and any gems in your application.
  end
end

