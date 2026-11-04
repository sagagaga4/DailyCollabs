import { canonicalThreadUrl } from '../Comments/commentThreads.js';

const THEMES = [
  { match: /skyrim|elder scrolls|סקיירים|סקיירם/i, label: 'Skyrim', icon: 'sword', hue: 195 },
  { match: /redis|רדיס/i, label: 'Redis', icon: 'stack', hue: 8 },
  { match: /music|album|song|guitar|jazz|מוזיקה|מוסיקה|שיר|אלבום/i, label: 'Music', icon: 'wave', hue: 35 },
  { match: /gaming|game|playstation|xbox|nintendo|minecraft|משחק/i, label: 'Gaming', icon: 'pixel', hue: 155 },
  { match: /film|movie|cinema|animation|סרט|קולנוע/i, label: 'Film & motion', icon: 'frame', hue: 210 },
  { match: /code|software|database|technology|developer|robot|openai|\bai\b|קוד|תוכנה|טכנולוג/i, label: 'Technology', icon: 'code', hue: 180 },
  { match: /nature|climate|forest|ocean|earth|טבע|אקלים|ים|יער/i, label: 'Our world', icon: 'globe', hue: 135 },
  { match: /design|art|painting|photograph|עיצוב|אמנות|צילום/i, label: 'Creative culture', icon: 'frame', hue: 28 },
];

export function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) { hash ^= character.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export function safeArtworkImage(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || [...value].some((character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127)) return null;
  try { const url = new URL(value.trim()); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function createArtworkRecipe({ url = '', title = '', topic = '' } = {}) {
  const headline = String(title || 'A fresh perspective').replace(/\s+/g, ' ').trim();
  const topicText = String(topic || '').trim();
  const identity = `${canonicalThreadUrl(url) || String(url).trim()}|${headline}`;
  const seed = stableHash(identity);
  const theme = THEMES.find((item) => item.match.test(`${topicText} ${headline}`));
  const random = (offset) => stableHash(`${identity}:${offset}`);
  const hue = ((theme?.hue ?? seed % 360) + (random('hue') % 49) - 24 + 360) % 360;
  return {
    identity, seed, headline, label: theme?.label || topicText.slice(0, 34) || 'Fresh perspective', icon: theme?.icon || 'orbit',
    hue, secondHue: (hue + 35 + random('second') % 100) % 360,
    code: seed.toString(36).toUpperCase().padStart(7, '0'),
    grid: 26 + random('grid') % 29,
    angle: -32 + random('angle') % 65,
    orbX: 475 + random('x') % 185, orbY: 90 + random('y') % 180,
    rings: Array.from({ length: 4 }, (_, index) => ({ x: 360 + random(`rx${index}`) % 460, y: 20 + random(`ry${index}`) % 420, r: 40 + random(`rr${index}`) % 200 })),
    bars: Array.from({ length: 14 }, (_, index) => 14 + random(`bar${index}`) % 120),
  };
}

export function wikimediaArtworkSource(value) {
  const image = safeArtworkImage(value);
  if (!image) return null;
  const url = new URL(image);
  if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const thumb = parts.indexOf('thumb');
  let file;
  try { file = decodeURIComponent(thumb >= 0 ? parts[thumb + 3] || '' : parts.at(-1) || ''); } catch { return null; }
  if (!file || !/\.(png|jpe?g|svg|webp|gif)$/i.test(file)) return null;
  const edition = parts[1];
  const host = edition === 'commons' ? 'commons.wikimedia.org' : /^[a-z]{2,3}$/.test(edition || '') ? `${edition}.wikipedia.org` : null;
  return host ? { imagePage: `https://${host}/wiki/File:${encodeURIComponent(file)}`, topic: file.replace(/_/g, ' ').replace(/\.[^.]+$/, '') } : null;
}
