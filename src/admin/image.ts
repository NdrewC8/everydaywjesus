interface OptimizedImage {
  original: Blob;
  thumbnail: Blob;
  extension: 'webp' | 'jpg';
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function resize(image: ImageBitmap, maxSize: number, type: string, quality: number): Promise<Blob> {
  const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지 변환 기능을 사용할 수 없습니다.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const output = await canvasBlob(canvas, type, quality);
  if (!output) throw new Error('이미지를 변환하지 못했습니다.');
  return output;
}

export async function optimizeImage(file: File): Promise<OptimizedImage> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('JPG, PNG, WebP 이미지만 올릴 수 있습니다.');
  if (file.size > 15 * 1024 * 1024) throw new Error('원본 이미지는 15MB 이하여야 합니다.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    let type = 'image/webp';
    let original = await resize(bitmap, 1600, type, 0.82);
    let thumbnail = await resize(bitmap, 480, type, 0.78);
    if (original.type !== type) {
      type = 'image/jpeg';
      original = await resize(bitmap, 1600, type, 0.84);
      thumbnail = await resize(bitmap, 480, type, 0.8);
    }
    return { original, thumbnail, extension: type === 'image/webp' ? 'webp' : 'jpg' };
  } finally {
    bitmap.close();
  }
}
