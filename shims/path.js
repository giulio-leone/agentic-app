/**
 * Shim for path — stub for Node.js path module on React Native.
 */
module.exports = {
  join: (...parts) => parts.join('/'),
  resolve: (...parts) => parts.join('/'),
  dirname: (p) => p.split('/').slice(0, -1).join('/'),
  basename: (p) => p.split('/').pop() || '',
  extname: (p) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ''; },
};
