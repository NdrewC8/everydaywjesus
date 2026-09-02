import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const required = ['index.html', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'content/snapshot.json', 'guide.html'];
for (const filename of required) await stat(path.join('dist', filename));

const sourceManifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert(JSON.stringify(sourceManifest) === JSON.stringify(manifest), 'Source and production manifests differ');
assert(manifest.id === '/' && manifest.start_url === '/' && manifest.scope === '/', 'PWA identity must remain at the domain root');
assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'), 'Maskable 512px icon is missing');

const snapshotText = await readFile('dist/content/snapshot.json', 'utf8');
const snapshot = JSON.parse(snapshotText);
assert(snapshot.schemaVersion === 2, 'Published snapshot schema is invalid');
assert(snapshot.resources.length > 0 && snapshot.churches.length > 0, 'Migrated content is unexpectedly empty');
assert(!snapshotText.includes('data:image'), 'Base64 images must not be stored in the snapshot');
assert(!/"http:\/\//.test(snapshotText), 'Insecure content URL found in the snapshot');

const guide = await readFile('dist/guide.html', 'utf8');
assert(!guide.includes('data:image'), 'Guide still contains an embedded Base64 image');
assert(Buffer.byteLength(guide) < 100_000, 'Guide HTML is unexpectedly large');

const assetFiles = await readdir('dist/assets');
const mainBundle = assetFiles.find((filename) => /^index-[^.]+\.js$/.test(filename));
assert(mainBundle, 'Main application bundle was not generated');
assert((await stat(path.join('dist/assets', mainBundle))).size < 300_000, 'Main application bundle exceeds 300KB');

console.log(`Build verification passed: ${snapshot.notices.length} notices, ${snapshot.resources.length} resources, ${snapshot.churches.length} churches.`);
