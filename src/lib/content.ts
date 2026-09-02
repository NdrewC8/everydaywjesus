import { fallbackSnapshot } from '../data/fallback';
import type { PublishedSnapshot } from '../types';
import { getDatabase } from './firebase';

const CACHE_KEY = 'ewj:published:v2';
const SNAPSHOT_PATH = import.meta.env.VITE_PUBLISHED_SNAPSHOT_PATH || 'published/current';

export function isSnapshot(value: unknown): value is PublishedSnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PublishedSnapshot>;
  return item.schemaVersion === 2 && Array.isArray(item.notices) && Array.isArray(item.resources) && Array.isArray(item.churches) && typeof item.settings?.siteName === 'string';
}

function readCache(): PublishedSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(snapshot: PublishedSnapshot): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Safari private mode or full storage must not prevent the app from opening.
  }
}

export async function loadPublishedSnapshot(): Promise<PublishedSnapshot> {
  const cached = readCache();
  const database = await getDatabase();
  if (!database) {
    try {
      const response = await fetch('/content/snapshot.json', { cache: 'no-cache' });
      const localSnapshot: unknown = response.ok ? await response.json() : null;
      if (isSnapshot(localSnapshot)) {
        writeCache(localSnapshot);
        return localSnapshot;
      }
    } catch {
      // The bundled fallback still makes the installed app usable offline.
    }
    return cached ?? fallbackSnapshot;
  }

  try {
    const [collectionName, documentName, ...extra] = SNAPSHOT_PATH.split('/').filter(Boolean);
    if (!collectionName || !documentName || extra.length) throw new Error('Invalid snapshot path');
    const { doc, getDoc } = await import('firebase/firestore');
    const response = await getDoc(doc(database, collectionName, documentName));
    const value: unknown = response.exists() ? response.data() : null;
    if (!isSnapshot(value)) throw new Error('Published snapshot schema is invalid');
    writeCache(value);
    return value;
  } catch (error) {
    console.warn('공개 콘텐츠를 불러오지 못해 저장된 콘텐츠를 표시합니다.', error);
    return cached ?? fallbackSnapshot;
  }
}
