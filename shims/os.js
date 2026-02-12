/**
 * Shim for os — stub for Node.js os module on React Native.
 */
module.exports = {
  homedir: () => '/data',
  tmpdir: () => '/tmp',
  platform: () => 'android',
  hostname: () => 'mobile',
  type: () => 'Linux',
  arch: () => 'arm64',
  cpus: () => [],
  totalmem: () => 0,
  freemem: () => 0,
  EOL: '\n',
};
