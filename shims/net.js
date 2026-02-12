/**
 * Shim for net — stub for Node.js net module on React Native.
 */
module.exports = {
  createConnection: () => { throw new Error('net not available on React Native'); },
  connect: () => { throw new Error('net not available on React Native'); },
  Socket: class Socket {},
  Server: class Server {},
};
