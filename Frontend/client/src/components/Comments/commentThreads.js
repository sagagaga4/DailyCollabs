import { parseVideoUrl } from '../../lib/media.js';
export function canonicalThreadUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const source = new URL(value);
    if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) return null;
    const url = new URL(parseVideoUrl(source.href)?.url || source.href);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key.toLowerCase())) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}
