const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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

// Fix engine.io-client: redirect Node.js-specific transport files to browser versions.
// With unstable_enablePackageExports (Expo SDK 54 default), the browser field file
// remapping in engine.io-client may be bypassed, causing Node.js-only modules (ws,
// http, net, tls) to be loaded in React Native, which crashes at runtime.
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Redirect engine.io-client .node.js files to their browser counterparts
    if (moduleName.endsWith('.node.js') || moduleName.endsWith('.node')) {
      const browserName = moduleName.replace(/\.node(\.js)?$/, '.js');
      try {
        return context.resolveRequest(context, browserName, platform);
      } catch (e) {
        // Fall through to default resolution
      }
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;