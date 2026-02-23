/**
 * Local cache for fetched model lists, backed by AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FetchedModel } from './ModelFetcher';

const CACHE_PREFIX = 'model_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedModels {
  models: FetchedModel[];
  fetchedAt: number;
}

export async function getCachedModels(
  providerType: string,
): Promise<FetchedModel[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${providerType}`);
    if (!raw) return null;
    const cached: CachedModels = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL) return null;
    return cached.models;
  } catch { /* corrupt cache entry */
    return null;
  }
}

export async function setCachedModels(
  providerType: string,
  models: FetchedModel[],
): Promise<void> {
  const data: CachedModels = { models, fetchedAt: Date.now() };
  await AsyncStorage.setItem(
    `${CACHE_PREFIX}${providerType}`,
    JSON.stringify(data),
  );
}

export async function isCacheStale(providerType: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${providerType}`);
    if (!raw) return true;
    const cached: CachedModels = JSON.parse(raw);
    return Date.now() - cached.fetchedAt > CACHE_TTL;
  } catch { /* corrupt cache — treat as stale */
    return true;
  }
}
