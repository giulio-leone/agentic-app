/**
 * Shim for http2 — stub for Node.js http2 module on React Native.
 */
module.exports = {
  connect: () => { throw new Error('http2 not available on React Native'); },
  constants: {},
};
