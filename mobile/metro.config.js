const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

let config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  allowOptionalDependencies: true,
  assetPlugins: ['expo-asset/tools/hashAssetFiles'],
};

module.exports = config;
