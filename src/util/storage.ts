/**
 * Thin key-value storage wrapper using expo-secure-store.
 * Drop-in replacement for AsyncStorage — same API (getItem / setItem / removeItem).
 * Works in Expo Go without any native build step.
 *
 * Limitation: expo-secure-store values must be strings ≤ 2048 bytes.
 * For our use case (tokens, names, small flags) this is always fine.
 */
import * as SecureStore from 'expo-secure-store'

// SecureStore keys must be alphanumeric + _ (no @ or -)
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '_')
}

export async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(sanitizeKey(key))
  } catch {
    return null
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(sanitizeKey(key), value)
  } catch { /* ignore */ }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(sanitizeKey(key))
  } catch { /* ignore */ }
}

const storage = { getItem, setItem, removeItem }
export default storage
