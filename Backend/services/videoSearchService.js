const { parseVideoUrl } = require('../utils/media');
const MAX_RESULTS = 8;
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function normalizeQuery(value) {
  if (typeof value !== 'string') return null;
  const query = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (query.length < 2 || query.length > 120 || /[\u0000-\u001f\u007f]/.test(query)) return null;
  return query;
}
function text(value) {
  const result = typeof value === 'string' ? value : value?.simpleText || value?.runs?.map(run => run.text || '').join('') || '';
  return result.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 500);
}
function decodeEntities(value) {
  return text(value).replace(/&(?:amp|quot|apos|lt|gt|#39|#x27);/gi, entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&#39;': "'", '&#x27;': "'" }[entity.toLowerCase()] || entity));
}
function video(id, title, channel, extras = {}) {
  if (!VIDEO_ID.test(id || '') || !text(title)) return null;
  const parsed = parseVideoUrl(`https://www.youtube.com/watch?v=${id}`);
  if (!parsed || parsed.provider !== 'youtube') return null;
  return { id, title: text(title), channel: text(channel) || 'YouTube creator', videoUrl: parsed.url, thumbnailUrl: parsed.thumbnailUrl,
    provider: 'youtube', duration: text(extras.duration).slice(0, 20), published: text(extras.published).slice(0, 80) };
}
// Parse data only; remote scripts are never evaluated.
function extractInitialData(html) {
  if (typeof html !== 'string' || html.length > MAX_PAGE_BYTES) throw new Error('Unsupported search response.');
  const marker = /(?:var\s+ytInitialData\s*=|window\[\s*["']ytInitialData["']\s*\]\s*=|(?:^|\s)ytInitialData\s*=)\s*/g;
  const found = marker.exec(html);
  if (!found) throw new Error('Search data is unavailable.');
  const start = found.index + found[0].length;
  if (html[start] !== '{') throw new Error('Invalid search data.');
  let depth = 0; let quoted = false; let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return JSON.parse(html.slice(start, index + 1));
  }
  throw new Error('Incomplete search data.');
}
function parsePublicResults(html) {
  const data = extractInitialData(html);
  const stack = [data]; const found = []; const seen = new Set(); let visited = 0;
  while (stack.length && found.length < MAX_RESULTS && visited++ < 150000) {
    const item = stack.pop();
    if (!item || typeof item !== 'object') continue;
    if (item.adSlotRenderer || item.promotedSparklesWebRenderer || item.promotedVideoRenderer) continue;
    if (item.videoRenderer) {
      const renderer = item.videoRenderer;
      const result = video(renderer.videoId, text(renderer.title), text(renderer.ownerText || renderer.longBylineText), { duration: renderer.lengthText, published: renderer.publishedTimeText });
      if (result && !renderer.isUnplayable && !renderer.upcomingEventData && !seen.has(result.id)) { found.push(result); seen.add(result.id); }
      continue;
    }
    // Reverse the stack to preserve the provider's result order.
    const children = Array.isArray(item) ? item : Object.values(item);
    for (let index = children.length - 1; index >= 0; index -= 1) if (children[index] && typeof children[index] === 'object') stack.push(children[index]);
  }
  return found;
}
function parseOfficialResults(data) {
  const seen = new Set();
  return (Array.isArray(data?.items) ? data.items : []).map(item => video(item.id?.videoId, decodeEntities(item.snippet?.title), decodeEntities(item.snippet?.channelTitle), { published: item.snippet?.publishedAt }))
    .filter(item => item && !seen.has(item.id) && seen.add(item.id)).slice(0, MAX_RESULTS);
}
async function limitedBody(response) {
  if (!response.ok) throw new Error('Search provider unavailable.');
  const announced = Number(response.headers?.get('content-length'));
  if (announced > MAX_PAGE_BYTES) throw new Error('Search response too large.');
  if (!response.body?.getReader) {
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_PAGE_BYTES) throw new Error('Search response too large.');
    return body;
  }
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PAGE_BYTES) { await reader.cancel(); throw new Error('Search response too large.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
function createVideoSearch({ fetchImpl = global.fetch, apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_YOUTUBE_API_KEY || '', now = Date.now } = {}) {
  const cache = new Map(); const inflight = new Map();
  async function fetchResults(query) {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    let videos;
    if (apiKey) {
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.search = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', safeSearch: 'moderate', maxResults: String(MAX_RESULTS), q: query, key: apiKey });
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(9000), redirect: 'error' });
        videos = parseOfficialResults(JSON.parse(await limitedBody(response)));
        if (videos.length) return { query, videos, status: 'ok', provider: 'YouTube Data API', searchUrl };
      } catch { /* Fall through to public results; never expose keys or upstream messages. */ }
    }
    try {
      const url = new URL(searchUrl);
      url.searchParams.set('hl', 'en');
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000), redirect: 'error', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DailyCollabs/1.0)', 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html' } });
      videos = parsePublicResults(await limitedBody(response));
      return { query, videos, status: videos.length ? 'ok' : 'empty', provider: 'YouTube public search', searchUrl,
        message: videos.length ? '' : 'No playable videos were returned for this topic. Try a more specific search.' };
    } catch {
      return { query, videos: [], status: 'unavailable', provider: 'YouTube', searchUrl,
        message: 'Video search is temporarily unavailable. You can still explore this topic on YouTube.' };
    }
  }
  return async function searchVideos(input) {
    const query = normalizeQuery(input);
    if (!query) { const error = new Error('Search for a topic between 2 and 120 characters.'); error.status = 400; throw error; }
    const key = query.toLocaleLowerCase('en-US');
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return { ...cached.value, query, cached: true };
    if (inflight.has(key)) return inflight.get(key);
    const pending = fetchResults(query).then(value => {
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(key, { value, expires: now() + (value.status === 'unavailable' ? 20000 : 15 * 60 * 1000) });
      return { ...value, cached: false };
    }).finally(() => inflight.delete(key));
    inflight.set(key, pending);
    return pending;
  };
}
// Topic search and For You share both successful results and in-flight work.
// A video already found for a deliberate search remains available when the
// reader returns to discovery, without a second request to the provider.
const searchVideos = createVideoSearch();
module.exports = { searchVideos, createVideoSearch, normalizeQuery, extractInitialData, parsePublicResults, parseOfficialResults, limitedBody };
