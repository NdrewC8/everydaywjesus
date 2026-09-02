import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const confirmed = process.argv.includes('--confirm');
const projectId = process.env.FIREBASE_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
if (!confirmed) throw new Error('외부 데이터를 쓰는 작업입니다. 검토 후 --confirm을 붙여 실행하세요.');
if (!projectId || !storageBucket) throw new Error('FIREBASE_PROJECT_ID와 FIREBASE_STORAGE_BUCKET이 필요합니다.');

initializeApp({ credential: applicationDefault(), projectId, storageBucket });
const database = getFirestore();
const bucket = getStorage().bucket();
const snapshotPath = path.resolve('public', 'content', 'snapshot.json');
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const uploaded = new Map();

async function uploadLocalUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/content/migrated/')) return value;
  if (uploaded.has(value)) return uploaded.get(value);
  const localPath = path.resolve('public', value.slice(1));
  const destination = `content/migrated/${path.basename(localPath)}`;
  const token = randomUUID();
  await bucket.upload(localPath, {
    destination,
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: { firebaseStorageDownloadTokens: token }
    }
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o/${encodeURIComponent(destination)}?alt=media&token=${token}`;
  uploaded.set(value, url);
  return url;
}

for (const resource of snapshot.resources) resource.thumbnailUrl = await uploadLocalUrl(resource.thumbnailUrl);
for (const notice of snapshot.notices) notice.imageUrls = await Promise.all((notice.imageUrls ?? []).map(uploadLocalUrl));
snapshot.publishedAt = new Date().toISOString();

const batch = database.batch();
for (const item of snapshot.resources) { const { id, ...data } = item; batch.set(database.doc(`resources/${id}`), data); }
for (const item of snapshot.notices) { const { id, ...data } = item; batch.set(database.doc(`notices/${id}`), data); }
for (const item of snapshot.churches) { const { id, ...data } = item; batch.set(database.doc(`churches/${id}`), data); }
batch.set(database.doc('siteSettings/main'), snapshot.settings);
batch.set(database.doc('published/current'), snapshot);
batch.set(database.collection('auditLogs').doc(), { actorUid: 'migration-script', action: 'initial-migration', createdAt: new Date(), counts: { resources: snapshot.resources.length, notices: snapshot.notices.length, churches: snapshot.churches.length } });
await batch.commit();
console.log(JSON.stringify({ projectId, storageBucket, uploadedImages: uploaded.size, resources: snapshot.resources.length, notices: snapshot.notices.length, churches: snapshot.churches.length }, null, 2));
