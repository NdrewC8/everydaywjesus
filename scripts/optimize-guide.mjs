import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourcePath = path.resolve('guide.html');
const outputPath = path.resolve('public', 'guide.html');
const assetDirectory = path.resolve('public', 'guide-assets');
await mkdir(assetDirectory, { recursive: true });

let html = await readFile(sourcePath, 'utf8');
const pattern = /data:image\/(?:png|jpe?g|webp);base64,[a-zA-Z0-9+/=\s]+/g;
const images = [...html.matchAll(pattern)].map((match) => match[0]);

for (const [index, dataUrl] of images.entries()) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1).replace(/\s/g, '');
  const filename = `guide-${index + 1}.webp`;
  await sharp(Buffer.from(base64, 'base64'))
    .rotate()
    .resize({ width: 1280, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(assetDirectory, filename));
  html = html.replace(dataUrl, `/guide-assets/${filename}`);
}

html = html.replace(/\s+onerror="[^"]*"/g, '');
await writeFile(outputPath, html, 'utf8');
console.log(JSON.stringify({ images: images.length, beforeBytes: (await readFile(sourcePath)).byteLength, afterBytes: Buffer.byteLength(html), outputPath }, null, 2));
