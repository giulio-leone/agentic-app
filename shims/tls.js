/**
 * Shim for tls — stub for Node.js tls module on React Native.
 */
module.exports = {
  connect: () => { throw new Error('tls not available on React Native'); },
  TLSSocket: class TLSSocket {},
  DEFAULT_ECDH_CURVE: 'auto',
};
