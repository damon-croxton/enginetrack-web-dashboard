const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The dashboard ships as a single bundled HTML file loaded by App.tsx. Metro
// treats .html as source by default, so it must be registered as an asset for
// `require('./assets/web/index.html')` to resolve.
config.resolver.assetExts = [...config.resolver.assetExts, 'html'];
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== 'html');

module.exports = config;
