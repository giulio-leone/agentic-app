/**
 * Shim for https — stub for Node.js https module on React Native.
 */
module.exports = {
  Agent: class Agent {},
  request: () => { throw new Error('https not available on React Native'); },
  get: () => { throw new Error('https not available on React Native'); },
  globalAgent: {},
};
