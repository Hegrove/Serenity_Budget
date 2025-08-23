const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure resolver for react-native-reanimated web compatibility
config.resolver.alias = {
  'react-native-reanimated': 'react-native-reanimated/lib/module/index.web.js',
};

module.exports = config;