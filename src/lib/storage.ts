import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * App-wide persistent key-value storage.
 *
 * Single swap point: everything (supabase auth, query cache, app prefs) goes
 * through this wrapper, so moving to MMKV later (needs a dev build; not
 * available in Expo Go) only changes this file.
 */
export const storage = {
  getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  },
  removeItem(key: string): Promise<void> {
    return AsyncStorage.removeItem(key);
  },
};

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await storage.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await storage.setItem(key, JSON.stringify(value));
}
