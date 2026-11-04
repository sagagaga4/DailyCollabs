const axios = require('axios');

const wikipediaApi = (language) => `https://${language}.wikipedia.org/w/api.php`;
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const PAGE_HOSTS = new Set(['en.wikipedia.org', 'commons.wikimedia.org']);
const ALIASES = [
  { match: /(?:\bskyrim\b|סקיירים|סקיירם)/i, title: 'The Elder Scrolls V: Skyrim' },
  { match: /(?:\bredis\b|רדיס)/i, title: 'Redis', commonsFile: 'File:Redis logo.svg' },
  { match: /\bminecraft\b/i, title: 'Minecraft' },
  { match: /\belden ring\b/i, title: 'Elden Ring' },
  { match: /\bopenai\b/i, title: 'OpenAI' },
  { match: /^ai$/i, title: 'Artificial intelligence' },
];
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'on', 'to', 'for', 'and', 'in', 'how', 'why', 'what', 'is', 'are', 'with', 'from', 'new', 'latest', 'news', 'says', 'will', 'about', 'after', 'before', 'today', 'more', 'than', 'this', 'that', 'its', 'their', 'has', 'have', 'been', 'not', 'our', 'your', 'you', 'it', 'by', 'at', 'as', 'or', 'can', 'could', 'should', 'into', 'out', 'just', 'get', 'gets', 'read', 'report', 'update']);
const words = (value) => (String(value || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((word) => word.length >= 2 && !STOP_WORDS.has(word) && !/^\p{N}+$/u.test(word));

function topicLanguage(query, locale) {
  const requested = typeof locale === 'string' ? locale : locale?.language;
  const base = String(requested || '').toLowerCase().split(/[-_]/)[0];
  if (/^[a-z]{2,3}$/.test(base) && !['any'].includes(base)) return base;
  if (/\p{Script=Hebrew}/u.test(query)) return 'he';
  if (/\p{Script=Arabic}/u.test(query)) return 'ar';
  if (/\p{Script=Cyrillic}/u.test(query)) return 'ru';
  return 'en';
}

function safeTrustedUrl(value, hosts) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password || url.port) return null;
    for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}

function normalizeTopic(value, locale) {
  if (typeof value !== 'string') return null;
  const query = value.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!query || /^https?:\/\//i.test(query)) return null;
  const known = ALIASES.find((item) => item.match.test(query));
  if (known) return { title: known.title, commonsFile: known.commonsFile, language: 'en', key: `en:${known.title.toLowerCase()}` };
  if (!words(query).length) return null;
  const language = topicLanguage(query, locale);
  return { title: query, language, key: `${language}:${query.toLowerCase()}` };
}

function plainMetadata(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 180);
}

function relevantTitle(title, topic) {
  const expected = words(topic);
  const actual = new Set(words(title));
  const matches = expected.filter((word) => actual.has(word)).length;
  return matches >= (expected.length > 2 ? 2 : 1);
}

function fromWikipediaPage(page, topic, language = 'en') {
  if (!page || page.missing || page.ns !== 0 || page.pageprops?.disambiguation !== undefined || !relevantTitle(page.title, topic)) return null;
  const image = safeTrustedUrl(page.thumbnail?.source, IMAGE_HOSTS);
  if (!image) return null;
  const imagePage = page.pageimage
    ? `https://${language}.wikipedia.org/wiki/File:${encodeURIComponent(page.pageimage.replace(/ /g, '_'))}`
    : safeTrustedUrl(page.fullurl, new Set([`${language}.wikipedia.org`]));
  return { image, imageSource: 'wikipedia-topic', imageCredit: `Wikipedia · ${plainMetadata(page.title)}`, imagePage: imagePage || '', isTopicImage: true, imageTopic: page.title, imageLanguage: language };
}

function fromCommonsPage(page, topic) {
  if (!page || page.missing || page.ns !== 6 || !relevantTitle(page.title, topic)) return null;
  const info = page.imageinfo?.[0];
  const image = safeTrustedUrl(info?.thumburl || info?.url, IMAGE_HOSTS);
  const imagePage = safeTrustedUrl(info?.descriptionurl, PAGE_HOSTS);
  if (!image || !imagePage) return null;
  const artist = plainMetadata(info.extmetadata?.Artist?.value);
  const license = plainMetadata(info.extmetadata?.LicenseShortName?.value);
  return { image, imageSource: 'wikimedia-commons-topic', imageCredit: [artist, license, 'Wikimedia Commons'].filter(Boolean).join(' · '), imagePage, isTopicImage: true, imageTopic: topic };
}

/** Fixed Wikimedia endpoints, bounded time, cache misses as well as successful images. */
function createTopicImageResolver({ httpGet = axios.get, now = Date.now, timeoutMs = 2800, ttlMs = 6 * 60 * 60 * 1000, negativeTtlMs = 60 * 1000, maxEntries = 200 } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function lookup(topic, signal, deadline) {
    const request = async (endpoint, params) => {
      const response = await httpGet(endpoint, { params: { action: 'query', format: 'json', formatversion: 2, ...params }, headers: { 'User-Agent': 'DailyCollabs/1.0 (+https://github.com/sagagaga4/DailyCollabs)' }, timeout: Math.max(1, deadline - now()), maxRedirects: 0, maxContentLength: 1024 * 1024, signal });
      if (response.data?.error) throw new Error('Topic image API rejected the request.');
      const pages = response.data?.query?.pages || [];
      return Array.isArray(pages) ? pages : Object.values(pages);
    };
    if (topic.commonsFile) {
      const pages = await request(COMMONS_API, { titles: topic.commonsFile, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: 960 });
      const result = pages.map((page) => fromCommonsPage(page, topic.title)).find(Boolean);
      if (result) return result;
    }
    const imageParams = { prop: 'pageimages|info|pageprops', piprop: 'thumbnail|name', pithumbsize: 960, pilicense: 'any', ppprop: 'disambiguation', inprop: 'url' };
    const exact = await request(wikipediaApi(topic.language), { ...imageParams, titles: topic.title, redirects: 1 });
    if (exact.some((page) => page.pageprops?.disambiguation !== undefined)) return null;
    const direct = exact.map((page) => fromWikipediaPage(page, topic.title, topic.language)).find(Boolean);
    if (direct) return direct;
    const search = await request(wikipediaApi(topic.language), { ...imageParams, generator: 'search', gsrsearch: topic.title, gsrnamespace: 0, gsrlimit: 3 });
    const localized = search.sort((a, b) => (a.index || 0) - (b.index || 0)).map((page) => fromWikipediaPage(page, topic.title, topic.language)).find(Boolean);
    if (localized) return localized;
    // A Latin-script topic may keep its English name inside a different news locale.
    if (topic.language !== 'en' && /[a-z]/i.test(topic.title)) {
      const english = await request(wikipediaApi('en'), { ...imageParams, titles: topic.title, redirects: 1 });
      return english.map((page) => fromWikipediaPage(page, topic.title, 'en')).find(Boolean) || null;
    }
    return null;
  }

  async function getTopicImage(value, locale) {
    const topic = normalizeTopic(value, locale);
    if (!topic) return null;
    const hit = cache.get(topic.key);
    if (hit && hit.expiresAt > now()) return hit.value;
    if (pending.has(topic.key)) return pending.get(topic.key);
    const promise = (async () => {
      const controller = new AbortController();
      let timer;
      try {
        const result = await Promise.race([
          lookup(topic, controller.signal, now() + timeoutMs),
          new Promise((resolve) => { timer = setTimeout(() => { controller.abort(); resolve(null); }, timeoutMs); }),
        ]).catch(() => null);
        if (cache.size >= maxEntries && !cache.has(topic.key)) cache.delete(cache.keys().next().value);
        cache.set(topic.key, { value: result, expiresAt: now() + (result ? ttlMs : negativeTtlMs) });
        return result;
      } finally { clearTimeout(timer); controller.abort(); pending.delete(topic.key); }
    })();
    pending.set(topic.key, promise);
    return promise;
  }
  return { getTopicImage, cache };
}

const resolver = createTopicImageResolver();
module.exports = { getTopicImage: resolver.getTopicImage, createTopicImageResolver, normalizeTopic, topicLanguage, safeTrustedUrl, fromWikipediaPage, fromCommonsPage, IMAGE_HOSTS };
