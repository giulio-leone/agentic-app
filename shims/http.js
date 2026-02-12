/**
 * Shim for http — stub for Node.js http module on React Native.
 */
module.exports = {
  Agent: class Agent {},
  request: () => { throw new Error('http not available on React Native'); },
  get: () => { throw new Error('http not available on React Native'); },
  globalAgent: {},
};
