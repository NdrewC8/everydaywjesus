import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectId = 'church-biz';
const collectionMap = {
  notices: 'ewj_notices',
  prayer: 'ewj_prayer',
  praise: 'ewj_praise',
  bible: 'ewj_bible',
  sermon: 'ewj_sermon',
  books: 'ewj_books',
  healing: 'ewj_healing',
  links: 'ewj_links',
  truth: 'ewj_truth'
};

const outputRoot = path.resolve('public', 'content');
const imageRoot = path.join(outputRoot, 'migrated');
await mkdir(imageRoot, { recursive: true });

function decodeValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {});
  return null;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

async function fetchCollection(collectionName, apiKey) {
  const documents = [];
  let pageToken = '';
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`);
    url.searchParams.set('pageSize', '300');
    if (apiKey) url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${collectionName}: Firestore ${response.status}`);
    const payload = await response.json();
    for (const document of payload.documents ?? []) {
      documents.push({ id: document.name.split('/').at(-1), ...decodeFields(document.fields ?? {}) });
    }
    pageToken = payload.nextPageToken ?? '';
  } while (pageToken);
  return documents;
}

function legacySource() {
  return execFileSync('git', ['show', 'hotfix/stability:index.html'], { encoding: 'utf8' });
}

function firebaseApiKey(source) {
  return source.match(/apiKey:\s*["']([^"']+)["']/)?.[1] ?? '';
}

function churchesFromSource(source) {
  const block = source.match(/const BRANCHES=\[([\s\S]*?)\n\];/)?.[1] ?? '';
  const churches = [];
  const pattern = /\{name:'([^']*)',addr:'([^']*)',tel:'([^']*)',note:'([^']*)',map:'([^']*)'\}/g;
  for (const match of block.matchAll(pattern)) {
    const [, name = '', address = '', phone = '', note = '', url = ''] = match;
    churches.push({
      id: `church-${churches.length + 1}`,
      name,
      region: address.split(' ')[0] || '기타',
      address: note ? `${address} · ${note}` : address,
      phone,
      url,
      order: churches.length
    });
  }
  return churches;
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

async function migrateImage(value, prefix, index) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('https://')) return value;
  const match = value.match(/^data:image\/(png|jpe?g|webp);base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) return null;
  const target = `${safeName(prefix)}-${index}.webp`;
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  await sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(imageRoot, target));
  return `/content/migrated/${target}`;
}

function asOrder(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function secureUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol === 'http:' && /(^|\.)youtube\.com$/i.test(url.hostname)) url.protocol = 'https:';
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

const source = legacySource();
const apiKey = firebaseApiKey(source);
const entries = await Promise.all(Object.entries(collectionMap).map(async ([section, collectionName]) => [section, await fetchCollection(collectionName, apiKey)]));
const collections = Object.fromEntries(entries);

const notices = [];
for (const [index, item] of collections.notices.entries()) {
  const sourceImages = Array.isArray(item.images) && item.images.length ? item.images : item.imageUrl ? [item.imageUrl] : [];
  const imageUrls = (await Promise.all(sourceImages.map((image, imageIndex) => migrateImage(image, `notice-${item.id}`, imageIndex + 1)))).filter(Boolean);
  notices.push({
    id: String(item.id),
    title: String(item.title ?? ''),
    ...(item.body ? { body: String(item.body) } : {}),
    ...(item.date ? { date: String(item.date) } : {}),
    ...(imageUrls.length ? { imageUrls } : {}),
    ...(secureUrl(item.linkUrl) ? { linkUrl: secureUrl(item.linkUrl) } : {}),
    ...(item.linkText ? { linkText: String(item.linkText) } : {}),
    order: asOrder(item.order, index)
  });
}

const resources = [];
for (const section of Object.keys(collectionMap).filter((key) => key !== 'notices')) {
  for (const [index, item] of collections[section].entries()) {
    const thumbnailUrl = await migrateImage(item.iconUrl ?? item.previewIcon ?? item.thumbnailUrl ?? item.imageUrl, `${section}-${item.id}`, 1);
    resources.push({
      id: String(item.id),
      section,
      title: String(item.title ?? ''),
      ...(item.sub || item.subtitle ? { subtitle: String(item.sub ?? item.subtitle) } : {}),
      url: secureUrl(item.url),
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      ...(item.label ? { label: String(item.label) } : {}),
      order: asOrder(item.order, index)
    });
  }
}

const snapshot = {
  schemaVersion: 2,
  publishedAt: new Date().toISOString(),
  notices: notices.sort((a, b) => a.order - b.order),
  resources: resources.sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order),
  churches: churchesFromSource(source),
  settings: {
    siteName: '매일 예수님과 함께',
    supportUrl: 'https://influencers.coupang.com/s/kingofsallim',
    inquiryUrl: 'https://open.kakao.com/o/sbqrs0jh'
  }
};

await writeFile(path.join(outputRoot, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ notices: snapshot.notices.length, resources: snapshot.resources.length, churches: snapshot.churches.length, output: path.join(outputRoot, 'snapshot.json') }, null, 2));
