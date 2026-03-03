const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow import.meta for web (required by @supabase/supabase-js and other ESM packages)
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

config.resolver = {
  ...config.resolver,
  unstable_enableSymlinks: true,
};

module.exports = config;
