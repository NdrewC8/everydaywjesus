import { describe, expect, it } from 'vitest';
import { safeContentUrl, safeExternalUrl, youtubeThumbnail } from './url';

describe('safeExternalUrl', () => {
  it('accepts https links only', () => {
    expect(safeExternalUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeExternalUrl('http://example.com')).toBeNull();
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('safeContentUrl', () => {
  it('accepts only migrated same-origin content paths or https URLs', () => {
    expect(safeContentUrl('/content/migrated/image.webp')).toBe('/content/migrated/image.webp');
    expect(safeContentUrl('/admin/index.html')).toBeNull();
  });
});

describe('youtubeThumbnail', () => {
  it('extracts a video id only from YouTube', () => {
    expect(youtubeThumbnail('https://youtu.be/dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(youtubeThumbnail('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});
