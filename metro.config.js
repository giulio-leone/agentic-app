const { getDefaultConfig } = require('expo/metro-config');
const nodePath = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

// Ensure mjs is resolved
config.resolver.sourceExts.push('mjs');

// Prioritize react-native condition exports (e.g. onecrawl native entry)
config.resolver.unstable_conditionNames = [
  'react-native',
  'import',
  'require',
  'default',
];

// Shim Node.js built-ins that onecrawl's non-native adapters reference
const NODE_SHIMS = {
  'fs/promises': nodePath.resolve(__dirname, 'shims/fs-promises.js'),
  'fs': nodePath.resolve(__dirname, 'shims/fs.js'),
  'path': nodePath.resolve(__dirname, 'shims/path.js'),
  'os': nodePath.resolve(__dirname, 'shims/os.js'),
  'net': nodePath.resolve(__dirname, 'shims/net.js'),
  'tls': nodePath.resolve(__dirname, 'shims/tls.js'),
  'http': nodePath.resolve(__dirname, 'shims/http.js'),
  'https': nodePath.resolve(__dirname, 'shims/https.js'),
  'http2': nodePath.resolve(__dirname, 'shims/http2.js'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (NODE_SHIMS[moduleName]) {
    return { filePath: NODE_SHIMS[moduleName], type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
