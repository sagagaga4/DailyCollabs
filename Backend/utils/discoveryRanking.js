const { tokens, canonicalUrl, topicMatches } = require('./feedRanking');

function relatedTopics(first, second) {
  const a = tokens(first, 30); const b = new Set(tokens(second, 30));
  return Boolean(a.length && b.size && (a.every(word => b.has(word)) || [...b].every(word => a.includes(word))));
}

function mutedTopic(topic, preferences = {}) {
  return (preferences.mutedTopics || []).some(muted => relatedTopics(topic, muted));
}

// Search provenance remains distinct from affinity weight: the last query gets
// a small allocation even when a saved topic has a much stronger weight.
function discoveryPlan(context) {
  const preferences = context.preferences || {};
  if (!preferences.personalized || preferences.mode === 'fresh') return { topics: [], recentTopic: '' };
  const candidates = (context.recentSearches || []).map(search => search.query).filter(Boolean);
  const recentTopic = preferences.mode === 'following' ? '' : candidates.find(topic => !mutedTopic(topic, preferences)) || '';
  const topics = recentTopic ? [recentTopic] : [];
  for (const interest of context.interests || []) {
    if (interest.weight <= 0 || mutedTopic(interest.topic, preferences)) continue;
    if (preferences.mode === 'following' && !['followed', 'saved-topic', 'community'].includes(interest.source)) continue;
    const topic = interest.source === 'bookmark' ? (interest.tokens || tokens(interest.topic)).slice(0, 3).join(' ') : interest.topic;
    if (!topic || topics.some(existing => relatedTopics(existing, topic))) continue;
    topics.push(topic);
    if (topics.length >= 2) break;
  }
  return { topics: topics.slice(0, 2), recentTopic };
}

function isRecentTopic(record, recentTopic) {
  if (!recentTopic) return false;
  const item = record.item;
  return relatedTopics(item.discoveryTopic || '', recentTopic) || topicMatches({ ...item, retrievalQuery: '' }, recentTopic);
}

// Keep at most a quarter of each page for the most recent topic. Also bound
// its total allocation, so an exhausted broad pool cannot turn into dozens of
// short pages containing only that one query. No synthetic filler is added.
function mixDiscoveryRecords(ranked, { pageSize = 12, recentTopic = '', chronological = false } = {}) {
  const remaining = []; const seen = new Set();
  for (const record of ranked) {
    const key = canonicalUrl(record.item.link || record.item.url || record.item.videoUrl);
    if (!key || seen.has(key)) continue;
    seen.add(key); remaining.push({ ...record, recentTopic: isRecentTopic(record, recentTopic) });
  }
  const perPageRecent = Math.max(1, Math.floor(pageSize / 4));
  const otherCount = remaining.filter(record => !record.recentTopic).length;
  const totalRecentBudget = recentTopic ? Math.max(perPageRecent, Math.floor(otherCount / 3)) : Infinity;
  let usedRecent = 0; const pages = [];
  while (remaining.length && pages.length < 50) {
    const page = []; let recentCount = 0; let videoCount = 0; let recentVideoUsed = false;
    const videoTarget = Math.max(1, Math.floor(pageSize / 4));
    for (let slot = 0; slot < pageSize; slot += 1) {
      const reserveRecentVideo = !recentVideoUsed && perPageRecent > 1 && remaining.some(record => record.recentTopic && record.item.kind === 'video') && usedRecent < totalRecentBudget;
      const eligible = record => !record.recentTopic || (recentCount < perPageRecent && usedRecent < totalRecentBudget && (record.item.kind === 'video' || !reserveRecentVideo || recentCount < perPageRecent - 1));
      const preferred = !chronological && videoCount < videoTarget && slot % 4 === 2 ? 'video' : 'article';
      let index = !chronological && slot === 0 ? remaining.findIndex(record => eligible(record) && record.recentTopic && record.item.kind === 'article') : -1;
      if (index < 0 && !chronological && preferred === 'video') index = remaining.findIndex(record => eligible(record) && record.item.priorityVideo);
      if (index < 0 && !chronological && preferred === 'video' && !recentVideoUsed) index = remaining.findIndex(record => eligible(record) && record.recentTopic && record.item.kind === 'video');
      if (index < 0) index = chronological ? remaining.findIndex(eligible) : remaining.findIndex(record => eligible(record) && record.item.kind === preferred);
      if (index < 0) index = remaining.findIndex(eligible);
      if (index < 0) break;
      const [record] = remaining.splice(index, 1); page.push(record);
      if (record.item.kind === 'video') videoCount += 1;
      if (record.recentTopic && record.item.kind === 'video') recentVideoUsed = true;
      if (record.recentTopic) { recentCount += 1; usedRecent += 1; }
    }
    if (!page.length) break;
    pages.push(page);
    if (page.length < pageSize) break;
  }
  return pages;
}

module.exports = { relatedTopics, mutedTopic, discoveryPlan, isRecentTopic, mixDiscoveryRecords };
