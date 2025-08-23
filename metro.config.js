// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  // Les .wasm doivent être vus comme des assets (et non comme du JS)
  config.resolver.assetExts.push('wasm');
  config.resolver.sourceExts = config.resolver.sourceExts.filter(
    ext => ext !== 'wasm'
  );

  // Optionnel : si tu utilises aussi du .cjs
  if (!config.resolver.sourceExts.includes('cjs')) {
    config.resolver.sourceExts.push('cjs');
  }

  return config;
})();