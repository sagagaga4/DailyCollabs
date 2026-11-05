import { parseVideoUrl } from '../../lib/media.js';
import { canonicalThreadUrl } from '../Comments/commentThreads.js';
import { safeArtworkImage } from '../Artwork/artworkRecipe.js';

function label(value, fallback = '') { return typeof value === 'string' ? value.trim() || fallback : fallback; }

export function normalizeMixedVideo(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const media = parseVideoUrl(item.videoUrl || item.url || item.link);
  if (!media) return null;
  return {
    ...item, kind: 'video', type: 'video', videoUrl: media.url, url: media.url, link: media.url,
    title: label(item.title, 'Untitled video'),
    thumbnailUrl: safeArtworkImage(item.thumbnailUrl || item.image) || '',
    image: safeArtworkImage(item.thumbnailUrl || item.image) || '',
    channel: label(item.channel, item.author?.username ? `@${item.author.username}` : ''), transcript: label(item.transcript), caption: label(item.caption || item.description),
    provider: label(item.provider, media.label), published: label(item.published || item.pubDate || item.createdAt),
    duration: label(item.duration), topic: label(item.topic),
    reasons: Array.isArray(item.reasons) ? item.reasons : [],
  };
}

/** The server ranks and mixes the feed. Preserve its order; remove duplicate sources only. */
export function normalizeMixedItems(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const result = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const kind = raw.kind || raw.type || (raw.videoUrl ? 'video' : 'article');
    if (!['article', 'video'].includes(kind)) continue;
    const item = kind === 'video' ? normalizeMixedVideo(raw) : { ...raw, kind: 'article', type: 'article', link: canonicalThreadUrl(raw.link || raw.url) };
    const source = item && canonicalThreadUrl(kind === 'video' ? item.videoUrl : item.link);
    if (!source || seen.has(source)) continue;
    seen.add(source);
    result.push({ kind, key: `${kind}:${source}`, item });
  }
  return result;
}

export function mixedFeedIdentity(item) {
  return normalizeMixedItems([item])[0]?.key || null;
}
