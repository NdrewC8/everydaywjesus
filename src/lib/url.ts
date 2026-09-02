export function safeExternalUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function safeContentUrl(value?: string): string | null {
  if (!value) return null;
  if (/^\/content\/[\w./-]+$/.test(value)) return value;
  return safeExternalUrl(value);
}

export function youtubeThumbnail(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    let videoId: string | null = null;
    if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
    if (host === 'youtube.com' || host === 'm.youtube.com') videoId = url.searchParams.get('v');
    return videoId && /^[\w-]{6,}$/.test(videoId) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}
