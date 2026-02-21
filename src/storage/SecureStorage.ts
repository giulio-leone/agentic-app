/**
 * Secure API key storage — wraps expo-secure-store with a fallback for web.
 *
 * Primary store: expo-secure-store (EncryptedSharedPreferences on Android).
 * Fallback:      localStorage on web (dev only).
 *
 * All operations are wrapped in try/catch so a broken Keystore (common on
 * emulators) never silently swallows errors.
 */

const KEY_PREFIX = 'ai_provider_key_';

function storageKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

// Lazy-load expo-secure-store so the module doesn't crash on web.
let _storeCache: typeof import('expo-secure-store') | null | undefined;

async function getSecureStore(): Promise<typeof import('expo-secure-store') | null> {
  if (_storeCache !== undefined) return _storeCache;
  try {
    _storeCache = await import('expo-secure-store');
  } catch {
    _storeCache = null;
  }
  return _storeCache;
}

export async function saveApiKey(id: string, key: string): Promise<boolean> {
  try {
    const store = await getSecureStore();
    if (store) {
      await store.setItemAsync(storageKey(id), key);
      return true;
    }
    // Web fallback — localStorage is *not* secure; acceptable for dev only.
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey(id), key);
      return true;
    }
  } catch {
  }
  return false;
}

export async function getApiKey(id: string): Promise<string | null> {
  try {
    const store = await getSecureStore();
    if (store) {
      const value = await store.getItemAsync(storageKey(id));
      return value;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(storageKey(id));
    }
  } catch {
  }
  return null;
}

export async function deleteApiKey(id: string): Promise<void> {
  try {
    const store = await getSecureStore();
    if (store) {
      await store.deleteItemAsync(storageKey(id));
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(storageKey(id));
    }
  } catch {
  }
}

export async function hasApiKey(id: string): Promise<boolean> {
  const key = await getApiKey(id);
  return key !== null && key.length > 0;
}
