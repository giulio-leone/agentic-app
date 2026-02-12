/**
 * Shim for fs/promises — used by onecrawl's FsStorageAdapter.
 * Not available on React Native; only MemoryStorageAdapter is used.
 */
module.exports = {
  readFile: () => Promise.reject(new Error('fs not available on React Native')),
  writeFile: () => Promise.reject(new Error('fs not available on React Native')),
  mkdir: () => Promise.reject(new Error('fs not available on React Native')),
  stat: () => Promise.reject(new Error('fs not available on React Native')),
  unlink: () => Promise.reject(new Error('fs not available on React Native')),
  readdir: () => Promise.reject(new Error('fs not available on React Native')),
};
