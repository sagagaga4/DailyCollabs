import { API_URL } from '../config';
export const BOOKMARK_EVENT = 'dailycollabs:bookmarks';
const pending = new Map();
const queues = new Map();
const loads = new Map();
const migrated = new Set();
function account() {
  try {
    const token = sessionStorage.getItem('token');
    const id = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).id;
    return typeof id === 'string' && id ? { id, token } : null;
  } catch { return null; }
}
function isActive(viewer) { const current = account(); return current?.id === viewer?.id && current?.token === viewer?.token; }
function assertActive(viewer) { if (!viewer || !isActive(viewer)) throw new Error('Your session changed. Please open your collection again.'); }
export function safeLink(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function text(value, limit) { return typeof value === 'string' ? value.slice(0, limit) : ''; }
function normalize(item) {
  const link = safeLink(item?.link || item?.url || item?.articleLink || item?.videoUrl);
  if (!link) return null;
  return { link, articleLink: link, title: text(item.title, 250) || new URL(link).hostname,
    description: text(item.description || item.caption, 1200), image: safeLink(item.image),
    pubDate: text(item.pubDate || item.createdAt, 100), type: item.type === 'video' || item.videoUrl ? 'video' : 'article',
    createdAt: text(item.createdAt, 100) || new Date().toISOString() };
}
function normalized(entries) {
  if (!Array.isArray(entries)) return [];
  const found = new Set();
  return entries.map(normalize).filter(item => item && !found.has(item.link) && found.add(item.link));
}
function readFor(viewer) {
  if (!viewer) return [];
  try {
    const scoped = JSON.parse(localStorage.getItem(`dailycollabs:bookmarks:${viewer.id}`) || 'null');
    if (Array.isArray(scoped)) return normalized(scoped);
    // Unowned legacy storage stays untouched; a different account must never claim it.
    if (localStorage.getItem('dailycollabs:legacy-bookmark-owner') !== viewer.id) return [];
    const legacy = JSON.parse(localStorage.getItem('bookmarkedArticles') || '[]');
    const cached = JSON.parse(sessionStorage.getItem('cachedArticles') || '[]');
    return normalized(Array.isArray(legacy) ? legacy.map(value => {
      const link = typeof value === 'string' ? value : value?.link;
      return (Array.isArray(cached) && cached.find(item => item?.link === link)) || (typeof value === 'string' ? { link } : value);
    }) : []);
  } catch { return []; }
}
export function readBookmarks() { return readFor(account()); }
function cache(viewer, entries) {
  assertActive(viewer);
  try { localStorage.setItem(`dailycollabs:bookmarks:${viewer.id}`, JSON.stringify(entries)); } catch { /* The server remains authoritative when storage is full. */ }
  window.dispatchEvent(new CustomEvent(BOOKMARK_EVENT, { detail: entries }));
}
function alreadyMigrated(viewer) {
  try { return migrated.has(viewer.id) || localStorage.getItem(`dailycollabs:bookmark-migrated:${viewer.id}`) === '1'; }
  catch { return migrated.has(viewer.id); }
}
function markMigrated(viewer) {
  migrated.add(viewer.id);
  try { localStorage.setItem(`dailycollabs:bookmark-migrated:${viewer.id}`, '1'); } catch { /* In-memory marker protects this session too. */ }
}
async function request(viewer, method, item) {
  assertActive(viewer);
  const response = await fetch(`${API_URL}/bookmarked`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewer.token}` }, ...(item ? { body: JSON.stringify(item) } : {}) });
  const data = await response.json().catch(() => ({}));
  assertActive(viewer);
  if (!response.ok) throw new Error(data.message || 'Bookmarks could not be updated.');
  return data;
}
function enqueue(viewer, operation) {
  if (!viewer) return Promise.reject(new Error('Sign in to save a story.'));
  const previous = queues.get(viewer.id) || Promise.resolve();
  const task = previous.catch(() => {}).then(() => { assertActive(viewer); return operation(); });
  queues.set(viewer.id, task);
  task.finally(() => { if (queues.get(viewer.id) === task) queues.delete(viewer.id); }).catch(() => {});
  return task;
}
export function loadBookmarks() {
  const viewer = account();
  if (!viewer) return Promise.reject(new Error('Sign in to open your collection.'));
  const key = `${viewer.id}:${viewer.token}`;
  if (loads.has(key)) return loads.get(key);
  const task = enqueue(viewer, async () => {
    const local = readFor(viewer);
    const remote = await request(viewer, 'GET');
    if (!Array.isArray(remote)) throw new Error('Your saved stories could not be loaded.');
    const entries = normalized(remote);
    // Import this account's old local collection once. Later refreshes honor server deletions.
    if (!alreadyMigrated(viewer)) {
      for (const item of local) if (!entries.some(entry => entry.link === item.link)) {
        entries.push(normalize(await request(viewer, 'POST', item)) || item);
      }
      markMigrated(viewer);
    }
    cache(viewer, entries);
    return entries;
  }).finally(() => loads.delete(key));
  loads.set(key, task);
  return task;
}
export function toggleBookmark(input, force) {
  const viewer = account();
  if (!viewer) return Promise.reject(new Error('Sign in to save a story.'));
  const item = normalize(input);
  if (!item) return Promise.reject(new Error('This story has no valid link.'));
  const key = `${viewer.id}:${viewer.token}:${item.link}`;
  if (pending.has(key)) return pending.get(key);
  const task = enqueue(viewer, async () => {
    const entries = readFor(viewer);
    const exists = entries.some(entry => entry.link === item.link);
    const adding = typeof force === 'boolean' ? force : !exists;
    const result = await request(viewer, adding ? 'POST' : 'DELETE', item);
    const saved = adding ? normalize(result) || item : item;
    const next = adding ? [saved, ...entries.filter(entry => entry.link !== item.link)] : entries.filter(entry => entry.link !== item.link);
    cache(viewer, next);
    return next;
  }).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
