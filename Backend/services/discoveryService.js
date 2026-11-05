const crypto = require('node:crypto');
const feedService = require('./feedService');
const { searchVideos: sharedVideoSearch, normalizeQuery } = require('./videoSearchService');
const { resolveNewsLocale, articleLocale } = require('../utils/newsLocale');
const { rankArticles, isHidden, languageMatches, canonicalUrl, tokens, topicMatches } = require('../utils/feedRanking');
const { parseVideoUrl } = require('../utils/media');
const { createFeedSessions } = require('../utils/feedSessions');
const { discoveryPlan, mixDiscoveryRecords, mutedTopic } = require('../utils/discoveryRanking');

function fail(message, status = 400, code) { const error = new Error(message); error.status = status; error.code = code; throw error; }
function validateRequest(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['language', 'region', 'page', 'pageSize', 'rankingSession'].includes(key))) fail('Use discovery pagination and language options. Search for a topic in Latest news.');
  const integer = (value, fallback, max, label) => { if (value === undefined) return fallback; if (!/^[1-9]\d*$/.test(String(value)) || Number(value) > max) fail(`Choose a valid ${label}.`); return Number(value); };
  const page = integer(input.page, 1, 50, 'page'); const pageSize = integer(input.pageSize, 12, 30, 'page size');
  const language = input.language === undefined ? 'auto' : input.language; const region = input.region === undefined ? '' : input.region;
  if (typeof language !== 'string' || typeof region !== 'string') fail('Choose valid language and region codes.');
  resolveNewsLocale('', language, region);
  const rankingSession = input.rankingSession;
  if (rankingSession !== undefined && (typeof rankingSession !== 'string' || !/^[\da-f-]{36}$/i.test(rankingSession))) fail('Invalid discovery snapshot.');
  if (page > 1 && !rankingSession) fail('Refresh the feed before loading more stories.', 409, 'FEED_SNAPSHOT_EXPIRED');
  return { page, pageSize, language, region, rankingSession };
}

function snapshotKey(request, locale, preferences) {
  return crypto.createHash('sha256').update(JSON.stringify([request.language, request.region, locale.tag, locale.ceid, request.pageSize, preferences])).digest('hex');
}

function createDiscoveryService({
  getContext = feedService.getContext,
  getRawItems = (...args) => require('../routers/rssRouter').localeHelpers.getRawItems(...args),
  enrichRecords = (...args) => require('../routers/rssRouter').feedHelpers.enrichRecords(...args),
  searchVideos = sharedVideoSearch,
  getMediaPosts = () => require('../model/MediaPost').find().sort({ createdAt: -1 }).limit(100).select('title caption transcript videoUrl provider author createdAt').populate('author', 'username avatar').lean(),
  now = Date.now,
  sessions = createFeedSessions(),
} = {}) {
  async function makeSnapshot(userId, request, locale, context, key, plan) {
    const queries = ['', ...plan.topics];
    const rawRequests = queries.map(async topic => {
      // Explicit language is a constraint. Auto can infer the user's current
      // script; publisher wording is always left in its original language.
      const topicLocale = resolveNewsLocale(topic || plan.recentTopic || plan.topics[0] || '', request.language, request.region);
      const items = await getRawItems(topic, topicLocale);
      return items.slice(0, 250).filter(item => !topic || topicMatches(item, topic)).map(item => ({ ...item, kind: 'article', discoveryTopic: topic }));
    });
    const videoTopics = plan.topics.map(normalizeQuery).filter(Boolean).slice(0, 2);
    const [news, videos, mediaResult] = await Promise.all([
      Promise.allSettled(rawRequests),
      Promise.allSettled(videoTopics.map(topic => searchVideos(topic))),
      Promise.resolve().then(getMediaPosts).then(value => ({ posts: value }), () => ({ posts: [] })),
    ]);
    const newsItems = news.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const videoResults = videos.filter(result => result.status === 'fulfilled').map(result => result.value);
    const videoItems = videoResults.flatMap(result => (result.videos || []).flatMap(video => {
      const link = canonicalUrl(video.videoUrl);
      if (!link || !languageMatches({ title: video.title, sourceLanguage: locale.tag }, locale)) return [];
      const metadata = articleLocale({ title: video.title }, locale);
      return [{ ...video, ...metadata, kind: 'video', link, url: link, image: video.thumbnailUrl, topic: result.query,
        discoveryTopic: result.query, sourceTitle: video.channel, contentSnippet: `${video.channel || ''} ${result.query || ''}`,
        pubDate: Number.isFinite(Date.parse(video.published || '')) ? video.published : '' }];
    }));
    let ownPriorityUsed = false;
    const sharedVideos = (mediaResult.posts || []).flatMap(post => {
      const media = parseVideoUrl(post.videoUrl);
      if (!media || !post.author) return [];
      const own = String(post.author._id || post.author) === String(userId);
      const candidate = { title: post.title, contentSnippet: post.caption || '', sourceLanguage: locale.tag };
      const related = context.preferences.personalized && (context.interests || []).some(interest => {
        if (interest.weight <= 0) return false;
        const required = interest.tokens || tokens(interest.topic);
        const words = new Set(tokens(`${post.title || ''} ${post.caption || ''}`, 300));
        return required.length && required.filter(word => words.has(word)).length >= Math.min(2, required.length);
      });
      if ((!own && !related) || !languageMatches(candidate, locale)) return [];
      const matchedTopic = plan.topics.find(topic => topicMatches(candidate, topic)) || '';
      const priorityVideo = own && !ownPriorityUsed;
      if (priorityVideo) ownPriorityUsed = true;
      return [{ kind: 'video', id: String(post._id), _id: String(post._id), title: post.title, caption: post.caption || '', transcript: post.transcript || '',
        videoUrl: media.url, link: media.url, url: media.url, provider: media.provider, thumbnailUrl: media.thumbnailUrl || null, image: media.thumbnailUrl || null,
        author: { _id: String(post.author._id || post.author), username: post.author.username || 'Community member', ...(post.author.avatar ? { avatar: post.author.avatar } : {}) },
        channel: post.author.username || 'Community member', sourceTitle: post.author.username || 'Community member',
        createdAt: post.createdAt, pubDate: post.createdAt, contentSnippet: post.caption || '', topic: matchedTopic, discoveryTopic: matchedTopic,
        priorityVideo, ownSharedVideo: own, ...articleLocale(candidate, locale) }];
    });
    // Real shared posts take precedence over the same URL returned by YouTube.
    const candidates = [...sharedVideos, ...newsItems, ...videoItems]
      .map(item => ({ ...item, link: parseVideoUrl(item.link || item.url)?.url || item.link || item.url }))
      .filter(item => !mutedTopic(item.discoveryTopic || '', context.preferences));
    const time = Math.floor(now() / 60000) * 60000;
    const ranked = rankArticles(candidates, context, { locale, now: time });
    for (const record of ranked) if (record.item.ownSharedVideo) record.reasons = ['A video you shared', ...record.reasons].slice(0, 3);
    const chronological = !context.preferences.personalized || context.preferences.mode === 'fresh';
    const pages = mixDiscoveryRecords(ranked, { pageSize: request.pageSize, recentTopic: plan.recentTopic, chronological });
    const status = videoItems.length || sharedVideos.length ? 'ok' : !videoTopics.length ? 'empty' : videoResults.some(result => result.status === 'unavailable') || videos.some(result => result.status === 'rejected') ? 'unavailable' : 'empty';
    const metadata = { algorithm: 'mixed-discovery-v1', personalized: !chronological, mode: chronological ? 'fresh' : context.preferences.mode,
      snapshotAt: new Date(time).toISOString(), candidateCount: candidates.length, eligibleCount: pages.reduce((count, page) => count + page.length, 0),
      signalsCount: context.signalsCount, recentTopic: plan.recentTopic, recentTopicLimit: Math.max(1, Math.floor(request.pageSize / 4)),
      topics: plan.topics, videoStatus: status, newsStatus: newsItems.length ? 'ok' : news.every(result => result.status === 'rejected') ? 'unavailable' : 'empty' };
    return sessions.create(userId, key, pages, metadata);
  }

  async function discover(userId, input) {
    if (!userId) fail('Please sign in again.', 401);
    const request = validateRequest(input);
    const context = await getContext(userId);
    const plan = discoveryPlan(context);
    const locale = resolveNewsLocale(plan.recentTopic || plan.topics[0] || '', request.language, request.region);
    const key = snapshotKey(request, locale, context.preferences);
    let snapshot = request.page > 1 ? sessions.get(request.rankingSession, userId, key) : null;
    if (request.page > 1 && !snapshot) fail('This feed snapshot has expired or your preferences changed. Refresh to continue.', 409, 'FEED_SNAPSHOT_EXPIRED');
    if (!snapshot) snapshot = await makeSnapshot(userId, request, locale, context, key, plan);
    const records = snapshot.records[request.page - 1] || [];
    const visible = records.filter(record => !isHidden(record.item, context));
    const articles = visible.filter(record => record.item.kind === 'article');
    let enrichmentFailed = false;
    const enriched = await enrichRecords(articles, '', locale, context).catch(() => { enrichmentFailed = true; return []; });
    // Resolution can replace a Google redirect URL. Keep record identity, then
    // recheck hard hides on the actual publisher URL before returning it.
    const articleResults = new Map(articles.map((record, index) => [record.key, enriched[index]]));
    // RSS enrichment may filter hidden resolved URLs; an index mapping would
    // shift identities. Resolve each record separately when a row disappeared.
    if (enriched.length !== articles.length) {
      articleResults.clear();
      await Promise.all(articles.map(async record => { try { const [item] = await enrichRecords([record], '', locale, context); if (item) articleResults.set(record.key, item); } catch { enrichmentFailed = true; } }));
    }
    const items = visible.flatMap(record => {
      const item = record.item.kind === 'video' ? { ...record.item, reasons: record.reasons } : articleResults.get(record.key);
      if (!item || isHidden(item, context)) return [];
      if (record.item.kind === 'video') { const { contentSnippet, discoveryTopic, sourceLanguage, retrievalQuery, priorityVideo, ownSharedVideo, ...video } = item; return [{ ...video, kind: 'video', type: 'video' }]; }
      return [{ ...item, kind: 'article', type: 'article', topic: record.item.discoveryTopic || '' }];
    });
    return { items, page: request.page, pageSize: request.pageSize, hasMore: request.page < snapshot.records.length,
      rankingSession: snapshot.id, locale, language: locale.language, region: locale.region,
      videoStatus: snapshot.metadata.videoStatus, ranking: { ...snapshot.metadata, ...(enrichmentFailed ? { newsStatus: articleResults.size ? 'partial' : 'unavailable' } : {}), session: snapshot.id } };
  }
  return { discover, sessions };
}

const discovery = createDiscoveryService();
module.exports = { discover: discovery.discover, createDiscoveryService, validateRequest, snapshotKey };
