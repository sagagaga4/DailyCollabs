export const PAGE_CACHE_LIMIT = 12;
export function pageCacheKey(location) {
  const pathname = location.pathname || '/';
  // Settings has one global appearance preview and no query-driven views.
  // Keep a single mounted draft even when a URL differs only by case, slash,
  // or an irrelevant query; community channel/invite queries remain distinct.
  if (pathname.replace(/\/+$/, '').toLowerCase() === '/settings') return '/Settings';
  return `${pathname}${location.search || ''}`;
}
export function locationIdentity(location) { return `${pageCacheKey(location)}|${location.key || 'default'}|${location.hash || ''}`; }
export function createPageCache(owner) { return { owner, entries: [], sequence: 0, locationIdentity: '' }; }

/** An in-memory LRU. Nothing from a previous session is copied to a new owner. */
export function visitPage(cache, owner, location, limit = PAGE_CACHE_LIMIT) {
  const current = cache.owner === owner ? cache : createPageCache(owner);
  const identity = locationIdentity(location);
  if (current.locationIdentity === identity) return current;
  const key = pageCacheKey(location); const sequence = current.sequence + 1;
  let entries = current.entries.map(entry => entry.key === key ? { ...entry, location, lastUsed: sequence } : entry);
  if (!entries.some(entry => entry.key === key)) entries.push({ key, location, lastUsed: sequence });
  const maximum = Math.max(1, Math.min(24, limit));
  while (entries.length > maximum) {
    const oldest = entries.filter(entry => entry.key !== key).reduce((first, entry) => !first || entry.lastUsed < first.lastUsed ? entry : first, null);
    entries = entries.filter(entry => entry !== oldest);
  }
  return { owner, entries, sequence, locationIdentity: identity };
}
