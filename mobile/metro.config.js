const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable Hermes bytecode in development to avoid asset resolver issues
config.transformer = {
  ...config.transformer,
  hermesEnabled: false,
  // Ensure inline requires are handled properly for animation performance
  inlineRequires: true,
};

// Configure the metro server to bind to all interfaces (so iPhone can reach it via WiFi)
config.server = {
  ...config.server,
  port: 8081,
  // Bind to all interfaces so WiFi connections work
  host: '0.0.0.0',
  // Enable file watching for better HMR
  watchFolders: [__dirname],
};

// Disable image optimization in dev to speed up bundler
config.transformer.asyncIterator = true;

module.exports = config;