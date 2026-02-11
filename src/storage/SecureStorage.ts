/**
 * Secure API key storage — wraps expo-secure-store with a fallback for web.
 */

const KEY_PREFIX = 'ai_provider_key_';

function storageKey(providerType: string): string {
  return `${KEY_PREFIX}${providerType}`;
}

// Lazy-load expo-secure-store so the module doesn't crash on web.
async function getSecureStore(): Promise<typeof import('expo-secure-store') | null> {
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

export async function saveApiKey(
  providerType: string,
  key: string,
): Promise<void> {
  const store = await getSecureStore();
  if (store) {
    await store.setItemAsync(storageKey(providerType), key);
  } else {
    // Web fallback — localStorage is *not* secure; acceptable for dev only.
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey(providerType), key);
    }
  }
}

export async function getApiKey(
  providerType: string,
): Promise<string | null> {
  const store = await getSecureStore();
  if (store) {
    return store.getItemAsync(storageKey(providerType));
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(storageKey(providerType));
  }
  return null;
}

export async function deleteApiKey(
  providerType: string,
): Promise<void> {
  const store = await getSecureStore();
  if (store) {
    await store.deleteItemAsync(storageKey(providerType));
  } else if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(storageKey(providerType));
  }
}

export async function hasApiKey(
  providerType: string,
): Promise<boolean> {
  const key = await getApiKey(providerType);
  return key !== null && key.length > 0;
}
