import { canonicalThreadUrl } from '../Comments/commentThreads';
export const homeItemUrl = item => canonicalThreadUrl((item?.kind || item?.type) === 'article' ? item?.link || item?.url : item?.videoUrl || item?.link || item?.url) || '';
export function homeFeedRequest(bucket, { topic = '', locale = {}, page = 1, rankingSession } = {}) {
  if (bucket === 'videos') return { path: `/video-search?${new URLSearchParams({ q: topic, language: locale.language || 'auto', ...(locale.region ? { region: locale.region } : {}) })}`, method: 'GET' };
  const body = { language: locale.language || 'auto', ...(locale.region ? { region: locale.region } : {}), page, pageSize: 12, ...(page > 1 && rankingSession ? { rankingSession } : {}) };
  return bucket === 'forYou' ? { path: '/feed/discover', body } : { path: '/rss', body: { ...body, query: topic, modeOverride: 'fresh' } };
}
const emptyBucket = () => ({ items: [], loading: false, loadingMore: false, loaded: false, error: '', page: 1, hasMore: false, rankingSession: null, requestId: null, videoStatus: 'idle' });
export function createHomeFeedState() {
  return { mode: 'all', topic: '', locale: { language: 'auto', region: '' }, searchId: null, forYou: emptyBucket(), news: emptyBucket(), videos: emptyBucket(), forYouDirty: false, forYouRevision: 0, tabRevision: 0, tabScroll: { all: { x: 0, y: 0 }, news: { x: 0, y: 0 }, videos: { x: 0, y: 0 } } };
}
export function shouldRefreshForYou(state, requestPending = false) {
  if (state.forYou.loaded && !state.forYouDirty) return false;
  return !requestPending || state.forYou.refreshRevision !== state.forYouRevision;
}
function uniqueItems(items) {
  const seen = new Set();
  return items.filter(item => { const key = homeItemUrl(item); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}
function completed(bucket, data, items, append = false) {
  return { ...bucket, items: uniqueItems(append ? [...bucket.items, ...items] : items), loading: false, loadingMore: false, loaded: true, error: data.error || '', page: data.page || 1, hasMore: Boolean(data.hasMore), rankingSession: data.rankingSession || null, videoStatus: data.videoStatus || bucket.videoStatus };
}
export function homeFeedReducer(state, action) {
  switch (action.type) {
    case 'mode': {
      if (action.mode === state.mode && !action.resetScroll) return state;
      const tabScroll = { ...state.tabScroll, ...(action.position ? { [state.mode]: action.position } : {}), ...(action.resetScroll ? { [action.mode]: { x: 0, y: 0 } } : {}) };
      return { ...state, mode: action.mode, tabScroll, tabRevision: state.tabRevision + 1 };
    }
    case 'for-you-dirty': return { ...state, forYouDirty: true, forYouRevision: state.forYouRevision + 1 };
    case 'fetch-start': {
      const bucket = state[action.bucket];
      return { ...state, [action.bucket]: { ...bucket, ...(action.append ? {} : { items: [], rankingSession: null, refreshRevision: state.forYouRevision }), loading: !action.append, loadingMore: Boolean(action.append), error: '', requestId: action.id } };
    }
    case 'fetch-success': {
      const bucket = state[action.bucket];
      if (bucket.requestId !== action.id) return state;
      return { ...state, [action.bucket]: completed(bucket, action.data, action.items, action.append), ...(action.bucket === 'forYou' && !action.append ? { forYouDirty: bucket.refreshRevision !== state.forYouRevision } : {}) };
    }
    case 'fetch-error': {
      const bucket = state[action.bucket];
      if (bucket.requestId !== action.id) return state;
      return { ...state, [action.bucket]: { ...bucket, loading: false, loadingMore: false, error: action.error } };
    }
    case 'search-start':
      return { ...state, mode: 'news', topic: action.query, locale: action.locale, searchId: action.id, news: { ...emptyBucket(), loading: true, requestId: action.id }, videos: { ...emptyBucket(), loading: true, requestId: action.id }, forYouDirty: true, forYouRevision: state.forYouRevision + 1, tabRevision: state.tabRevision + 1, tabScroll: { ...state.tabScroll, ...(action.position ? { [state.mode]: action.position } : {}), news: { x: 0, y: 0 }, videos: { x: 0, y: 0 } } };
    case 'search-videos':
      if (state.searchId !== action.id || state.videos.requestId !== action.id) return state;
      return { ...state, videos: completed(state.videos, { error: action.data.status === 'unavailable' ? action.data.message : '' }, (action.data.videos || []).map(item => ({ ...item, kind: 'video' }))) };
    case 'search-success': {
      if (state.searchId !== action.id || state.news.requestId !== action.id) return state;
      const data = action.data;
      return { ...state,
        news: completed(state.news, { ...data, error: data.newsMessage || '' }, (data.articles || []).map(item => ({ ...item, kind: 'article' }))),
        videos: state.videos.requestId === action.id ? completed(state.videos, { error: data.videoStatus === 'unavailable' ? data.videoMessage : '' }, (data.videos || []).map(item => ({ ...item, kind: 'video' }))) : state.videos,
      };
    }
    case 'search-end': {
      if (state.searchId !== action.id) return state;
      const finish = bucket => bucket.requestId !== action.id ? bucket : ({ ...bucket, loading: false, ...(action.cancelled && !bucket.loaded ? { error: 'Search cancelled. Search again when you are ready.' } : {}) });
      return { ...state, news: finish(state.news), videos: finish(state.videos) };
    }
    case 'clear-topic':
      return { ...state, topic: '', searchId: null, news: emptyBucket(), videos: emptyBucket(), tabRevision: state.tabRevision + 1, tabScroll: { ...state.tabScroll, news: { x: 0, y: 0 }, videos: { x: 0, y: 0 } } };
    case 'hide': {
      const url = canonicalThreadUrl(action.url);
      if (!url) return state;
      return { ...state, ...Object.fromEntries(['forYou', 'news', 'videos'].map(name => [name, { ...state[name], items: state[name].items.filter(item => homeItemUrl(item) !== url) }])) };
    }
    case 'remove-media':
      return { ...state, ...Object.fromEntries(['forYou', 'news', 'videos'].map(name => [name, { ...state[name], items: state[name].items.filter(item => String(item._id || item.id || '') !== String(action.id)) }])) };
    case 'restore': {
      const next = { ...state };
      for (const location of action.locations) {
        const bucket = next[location.bucket];
        if (bucket.requestId !== location.requestId || bucket.items.some(item => homeItemUrl(item) === homeItemUrl(location.item))) continue;
        const items = [...bucket.items]; items.splice(Math.min(location.index, items.length), 0, location.item);
        next[location.bucket] = { ...bucket, items };
      }
      return next;
    }
    default: return state;
  }
}
