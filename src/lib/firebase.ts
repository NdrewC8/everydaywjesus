import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export function hasFirebaseConfig(): boolean {
  return Object.values(config).every((value) => typeof value === 'string' && value.length > 0);
}

export async function getFirebaseApp(): Promise<FirebaseApp | null> {
  if (!hasFirebaseConfig()) return null;
  const { getApps, initializeApp } = await import('firebase/app');
  return getApps()[0] ?? initializeApp(config);
}

export async function getDatabase(): Promise<Firestore | null> {
  const app = await getFirebaseApp();
  if (!app) return null;
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(app);
}
