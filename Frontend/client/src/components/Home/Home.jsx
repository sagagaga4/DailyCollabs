import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import LinkIcon from '@mui/icons-material/Link';
import SearchBar from '../Searchbar/Searchbar';
import VideoPlayer from './VideoPlayer';
import ArticleArtwork from '../Artwork/ArticleArtwork';
import FeedControls, { WhyThisStory } from '../FeedControls/FeedControls';
import { sendFeedSignal, waitForSearchSignals } from '../FeedControls/feedSignals';
import { DraggableCard, CommunityTags } from '../CardActions';
import { BOOKMARK_EVENT, loadBookmarks, readBookmarks, toggleBookmark } from '../../lib/bookmarks';
import { getArticleVideo } from '../../lib/media';
import { readCachedProfile, PROFILE_EVENT } from '../../lib/profile';
import { API_URL } from '../../config';
import './Home.css';

import MixedVideoCard from './MixedVideoCard';
import ShareVideoButton from './ShareVideoButton';
import { normalizeMixedItems } from './mixedFeed';
import { usePageActive } from '../Navigation/PageActivity';
import { captureScrollPosition, restoreScrollPosition } from '../Navigation/scrollPosition';
import { createHomeFeedState, homeFeedReducer, homeFeedRequest, homeItemUrl, shouldRefreshForYou } from './homeFeedState';

export default function Home() {
  const token = sessionStorage.getItem('token');
  const pageActive = usePageActive();
  const pageActiveRef = useRef(pageActive); pageActiveRef.current = pageActive;
  const [currentUser, setCurrentUser] = useState(readCachedProfile);
  const [feed, dispatch] = useReducer(homeFeedReducer, undefined, createHomeFeedState);
  const stateRef = useRef(feed); stateRef.current = feed;
  const modeRef = useRef(feed.mode); modeRef.current = feed.mode;
  const [searchReset, setSearchReset] = useState(0);
  const [userReactions, setUserReactions] = useState({});
  const [reactionCounts, setReactionCounts] = useState({});
  const [bookmarkedArticles, setBookmarkedArticles] = useState(() => new Set(readBookmarks().map(item => item.link)));
  const [feedbackBusy, setFeedbackBusy] = useState({});
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [hiddenStory, setHiddenStory] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const mounted = useRef(true);
  const sentinelRef = useRef(null);
  const pendingTabScroll = useRef(null);
  const autoPage = useRef(true);
  const bookmarkBaselineReady = useRef(false);
  const bookmarkIdentity = useRef(readBookmarks().map(item => item.link).sort().join('\n'));
  const controllers = useRef(new Map());
  const generation = useRef(0);
  const hiddenUrls = useRef(new Set());
  const feedbackRequests = useRef(new Set());
  const reactionRequests = useRef(new Set());
  const activeSearch = useRef(null);
  const loadFeedRef = useRef(null);
  const refreshRef = useRef(null);

  const loadReactions = useCallback(async (items, authToken) => {
    if (!authToken) return;
    const rows = await Promise.all(items.filter(item => item.kind !== 'video').map(async story => {
      try {
        const headers = { Authorization: `Bearer ${authToken}` };
        const [mine, counts] = await Promise.all([
          fetch(`${API_URL}/reactions/${encodeURIComponent(story.link)}/my`, { headers }).then(response => response.ok ? response.json() : null),
          fetch(`${API_URL}/reactions/${encodeURIComponent(story.link)}/count`, { headers }).then(response => response.ok ? response.json() : null),
        ]);
        return { url: story.link, mine, counts };
      } catch { return null; }
    }));
    if (!mounted.current || sessionStorage.getItem('token') !== authToken) return;
    const mine = {}; const counts = {};
    rows.filter(Boolean).forEach(row => { if (row.mine) mine[row.url] = row.mine.reaction || null; if (row.counts) counts[row.url] = row.counts; });
    setUserReactions(previous => ({ ...previous, ...mine }));
    setReactionCounts(previous => ({ ...previous, ...counts }));
  }, []);

  loadFeedRef.current = async (bucket, append = false, overrides = {}) => {
    controllers.current.get(bucket)?.abort();
    const controller = new AbortController(); controllers.current.set(bucket, controller);
    const id = `feed-${++generation.current}`;
    const state = stateRef.current; const previous = state[bucket];
    const authToken = sessionStorage.getItem('token');
    const request = homeFeedRequest(bucket, { topic: overrides.topic ?? state.topic, locale: state.locale, page: append ? previous.page + 1 : 1, rankingSession: append ? previous.rankingSession : undefined });
    const learnedSearch = bucket === 'forYou' ? waitForSearchSignals() : null;
    dispatch({ type: 'fetch-start', bucket, id, append });
    try {
      if (learnedSearch) await learnedSearch;
      if (!mounted.current || controller.signal.aborted || sessionStorage.getItem('token') !== authToken) return;
      const response = await fetch(`${API_URL}${request.path}`, { method: request.method || 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, ...(request.body ? { body: JSON.stringify(request.body) } : {}), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Could not load your feed.');
      if (!mounted.current || controller.signal.aborted || sessionStorage.getItem('token') !== authToken) return;
      const items = normalizeMixedItems(bucket === 'forYou' ? data.items || [] : bucket === 'videos' ? (data.videos || []).map(item => ({ ...item, kind: 'video' })) : (data.articles || []).map(item => ({ ...item, kind: 'article' }))).map(node => node.item).filter(item => !hiddenUrls.current.has(homeItemUrl(item)));
      dispatch({ type: 'fetch-success', bucket, id, append, data: bucket === 'videos' && data.status === 'unavailable' ? { ...data, error: data.message || 'Video search is unavailable. Try again.' } : data, items });
      loadReactions(items, authToken);
    } catch (failure) {
      if (failure.name !== 'AbortError' && mounted.current && !controller.signal.aborted && sessionStorage.getItem('token') === authToken) dispatch({ type: 'fetch-error', bucket, id, error: failure.message });
    } finally { if (controllers.current.get(bucket) === controller) controllers.current.delete(bucket); }
  };
  refreshRef.current = () => {
    const state = stateRef.current;
    if (state.mode === 'all' || (state.mode === 'videos' && !state.topic)) return loadFeedRef.current('forYou');
    if (state.mode === 'videos') return loadFeedRef.current('videos');
    if (!activeSearch.current?.pending) return loadFeedRef.current('news');
  };

  useEffect(() => {
    mounted.current = true;
    const requests = controllers.current;
    loadFeedRef.current('forYou'); loadBookmarks().catch(() => {}).finally(() => { bookmarkBaselineReady.current = true; });
    return () => { mounted.current = false; requests.forEach(controller => controller.abort()); requests.clear(); };
  }, []);
  useEffect(() => {
    const profile = event => setCurrentUser(event.detail || readCachedProfile());
    const bookmarks = event => {
      const links = (event.detail || readBookmarks()).map(item => item.link);
      const identity = [...links].sort().join('\n');
      if (bookmarkBaselineReady.current && identity !== bookmarkIdentity.current) dispatch({ type: 'for-you-dirty' });
      bookmarkIdentity.current = identity; setBookmarkedArticles(new Set(links));
    };
    const preferences = event => { if (event.detail?.signalsCount === 0) hiddenUrls.current.clear(); setHiddenStory(null); dispatch({ type: 'for-you-dirty' }); if (pageActiveRef.current && modeRef.current === 'all') loadFeedRef.current('forYou'); };
    const media = event => { dispatch({ type: 'for-you-dirty' }); if (event.detail?.action === 'removed') dispatch({ type: 'remove-media', id: event.detail.id }); if (pageActiveRef.current && modeRef.current === 'all') loadFeedRef.current('forYou'); };
    const communities = () => dispatch({ type: 'for-you-dirty' });
    window.addEventListener('dailycollabs:communities', communities);
    window.addEventListener('dailycollabs:media', media);
    window.addEventListener(PROFILE_EVENT, profile); window.addEventListener(BOOKMARK_EVENT, bookmarks); window.addEventListener('dailycollabs:feed-preferences', preferences);
    return () => { window.removeEventListener('dailycollabs:communities', communities); window.removeEventListener('dailycollabs:media', media); window.removeEventListener(PROFILE_EVENT, profile); window.removeEventListener(BOOKMARK_EVENT, bookmarks); window.removeEventListener('dailycollabs:feed-preferences', preferences); };
  }, []);

  const loadMore = useCallback(() => {
    if (!pageActiveRef.current) return;
    const state = stateRef.current;
    const bucket = state.mode === 'all' || (state.mode === 'videos' && !state.topic) ? 'forYou' : state.mode === 'news' ? 'news' : null;
    if (!bucket || state[bucket].loading || state[bucket].loadingMore || !state[bucket].hasMore || controllers.current.has(bucket)) return;
    loadFeedRef.current(bucket, true);
  }, []);
  const activeBucket = feed.mode === 'all' || (feed.mode === 'videos' && !feed.topic) ? 'forYou' : feed.mode;
  const active = feed[activeBucket];
  const visibleItems = feed.mode === 'videos' && !feed.topic ? active.items.filter(item => item.kind === 'video') : active.items;
  const nodes = normalizeMixedItems(visibleItems);
  useEffect(() => {
    if (!pageActive || active.loading || (feed.mode === 'videos' && feed.topic)) return;
    const element = sentinelRef.current; if (!element) return;
    const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && autoPage.current) loadMore(); }, { rootMargin: '600px' });
    observer.observe(element); return () => observer.disconnect();
  }, [pageActive, feed.mode, feed.topic, active.loading, loadMore]);

  useEffect(() => {
    if (!pageActive) { autoPage.current = false; return; }
    const resume = event => {
      if (event.type === 'keydown' && (!['ArrowDown', 'PageDown', 'End', ' '].includes(event.key) || event.target?.closest?.('input, textarea, select, [contenteditable="true"]'))) return;
      autoPage.current = true;
      if (sentinelRef.current?.getBoundingClientRect().top < window.innerHeight + 600) loadMore();
    };
    window.addEventListener('wheel', resume, { passive: true }); window.addEventListener('touchmove', resume, { passive: true }); window.addEventListener('keydown', resume);
    return () => { window.removeEventListener('wheel', resume); window.removeEventListener('touchmove', resume); window.removeEventListener('keydown', resume); };
  }, [pageActive, loadMore]);

  useLayoutEffect(() => {
    if (!pageActive) { pendingTabScroll.current = null; return; }
    const position = pendingTabScroll.current; pendingTabScroll.current = null;
    if (position) return restoreScrollPosition(position);
  }, [pageActive, feed.tabRevision]);

  async function reactToStory(article, type) {
    const url = article.link;
    if (!token || reactionRequests.current.has(url)) return;
    reactionRequests.current.add(url); setFeedbackError('');
    try {
      const response = await fetch(`${API_URL}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ articleLink: url, type }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Your reaction could not be saved.');
      if (!mounted.current || sessionStorage.getItem('token') !== token) return;
      setUserReactions(previous => ({ ...previous, [url]: data.status?.includes('removed') ? null : type }));
      if (data.count) setReactionCounts(previous => ({ ...previous, [url]: data.count }));
    } catch (failure) { if (mounted.current) setFeedbackError(failure.message); }
    finally { reactionRequests.current.delete(url); }
  }
  async function bookmarkStory(article) { try { await toggleBookmark(article); } catch (failure) { if (mounted.current) setFeedbackError(failure.message); } }
  async function copyStory(url) { try { await navigator.clipboard.writeText(url); setFeedbackNotice('Story link copied.'); } catch { setFeedbackError('The link could not be copied. Open the story and copy its address.'); } }
  function openStory(item) { sendFeedSignal('open', { url: homeItemUrl(item), title: item.title }).then(result => { if (mounted.current && result.recorded) dispatch({ type: 'for-you-dirty' }); }).catch(() => {}); }
  async function feedback(item, type) {
    const url = homeItemUrl(item); if (feedbackRequests.current.has(url)) return;
    feedbackRequests.current.add(url); setFeedbackBusy(previous => ({ ...previous, [url]: true })); setFeedbackError(''); setFeedbackNotice('');
    try {
      const saved = await sendFeedSignal(type, { url, title: item.title });
      if (!saved.recorded) throw new Error('Sign in to save feed feedback.');
      if (!mounted.current) return;
      dispatch({ type: 'for-you-dirty' });
      if (type === 'hide') {
        const state = stateRef.current;
        const locations = ['forYou', 'news', 'videos'].flatMap(bucket => state[bucket].items.flatMap((entry, index) => homeItemUrl(entry) === url ? [{ bucket, index, item: entry, requestId: state[bucket].requestId }] : []));
        hiddenUrls.current.add(url); dispatch({ type: 'hide', url }); setHiddenStory({ item, locations });
      } else { setFeedbackNotice(type === 'more' ? 'Preference saved: more like this.' : 'Preference saved: less like this.'); }
    } catch (failure) { if (mounted.current) setFeedbackError(failure.message); }
    finally { feedbackRequests.current.delete(url); if (mounted.current) setFeedbackBusy(previous => ({ ...previous, [url]: false })); }
  }
  async function undoHide() {
    if (!hiddenStory || undoing) return;
    const hidden = hiddenStory; setUndoing(true); setFeedbackError('');
    try {
      const saved = await sendFeedSignal('unhide', { url: homeItemUrl(hidden.item), title: hidden.item.title });
      if (!saved.recorded) throw new Error('Sign in to restore this story.');
      if (!mounted.current) return;
      dispatch({ type: 'for-you-dirty' });
      hiddenUrls.current.delete(homeItemUrl(hidden.item)); dispatch({ type: 'restore', locations: hidden.locations }); setHiddenStory(null); setFeedbackNotice('Story restored.');
    } catch (failure) { if (mounted.current) setFeedbackError(failure.message); }
    finally { if (mounted.current) setUndoing(false); }
  }

  function acceptsSearch(payload) { return mounted.current && activeSearch.current?.id === payload.requestId && activeSearch.current?.token === sessionStorage.getItem('token'); }
  function searchResults(payload) {
    if (!acceptsSearch(payload)) return;
    const data = { ...payload, articles: normalizeMixedItems((payload.articles || []).map(item => ({ ...item, kind: 'article' }))).map(node => node.item).filter(item => !hiddenUrls.current.has(homeItemUrl(item))), videos: normalizeMixedItems((payload.videos || []).map(item => ({ ...item, kind: 'video' }))).map(node => node.item).filter(item => !hiddenUrls.current.has(homeItemUrl(item))) };
    dispatch({ type: 'search-success', id: payload.requestId, data }); loadReactions(data.articles, activeSearch.current.token);
  }
  function searchVideos(payload) { if (acceptsSearch(payload)) dispatch({ type: 'search-videos', id: payload.requestId, data: { ...payload, videos: normalizeMixedItems((payload.videos || []).map(item => ({ ...item, kind: 'video' }))).map(node => node.item).filter(item => !hiddenUrls.current.has(homeItemUrl(item))) } }); }
  function searchState(payload) {
    if (payload.loading) {
      controllers.current.get('news')?.abort(); controllers.current.delete('news');
      activeSearch.current = { id: payload.requestId, token: sessionStorage.getItem('token'), pending: true, signalPromise: payload.signalPromise };
      const position = pageActiveRef.current ? captureScrollPosition() : undefined;
      if (pageActiveRef.current) pendingTabScroll.current = { x: 0, y: 0 };
      autoPage.current = false; modeRef.current = 'news';
      dispatch({ type: 'search-start', position, id: payload.requestId, query: payload.query, locale: { language: payload.language || 'auto', region: payload.region || '' } });
    } else if (acceptsSearch(payload)) { activeSearch.current.pending = false; dispatch({ type: 'search-end', id: payload.requestId, cancelled: payload.cancelled }); }
  }
  function chooseView(mode) {
    const state = stateRef.current;
    const refresh = mode === 'all' && shouldRefreshForYou(state, controllers.current.has('forYou'));
    if (mode !== state.mode || refresh) {
      pendingTabScroll.current = refresh ? { x: 0, y: 0 } : state.tabScroll[mode];
      autoPage.current = false;
    }
    const position = pageActiveRef.current ? captureScrollPosition() : undefined;
    modeRef.current = mode; dispatch({ type: 'mode', mode, position, resetScroll: refresh });
    if (refresh) loadFeedRef.current('forYou');
    else if (mode === 'news' && !state.news.loaded && !state.news.loading) loadFeedRef.current('news');
    else if (mode === 'videos' && !state.topic && !state.forYou.loaded && !state.forYou.loading) loadFeedRef.current('forYou');
  }
  function clearTopic() {
    if (pageActiveRef.current) pendingTabScroll.current = { x: 0, y: 0 };
    autoPage.current = false;
    activeSearch.current = null; controllers.current.get('news')?.abort(); controllers.current.delete('news'); setSearchReset(value => value + 1); dispatch({ type: 'clear-topic' });
    if (modeRef.current === 'news') loadFeedRef.current('news', false, { topic: '' });
  }
  function renderArticle(article) {
const reaction = userReactions[article.link]; const counts = reactionCounts[article.link]; const articleVideo = getArticleVideo(article);
        const shared = { title: article.title || 'A story worth sharing', url: articleVideo?.url || article.link, image: article.image, description: article.description || '', type: articleVideo ? 'video' : 'article' };
        return <div key={article.link} className="card-content" data-scroll-anchor={`article:${homeItemUrl(article)}`}><DraggableCard content={shared}><article className="card"><div className="card-header"><div className="button-wrapper"><a href={article.link} target="_blank" rel="noopener noreferrer" className="button" onClick={() => openStory(article)} onAuxClick={event => { if (event.button === 1) openStory(article); }}>Read story ↗</a></div><h3 className="head" dir="auto" lang={article.language || article.lang || undefined}>{article.title || 'Untitled'}</h3><div className="content"><p className="home-article-date">{article.sourceTitle && <span dir="auto">{article.sourceTitle} · </span>}{article.pubDate && !Number.isNaN(Date.parse(article.pubDate)) ? new Date(article.pubDate).toLocaleDateString() : ''}</p>{article.description && <p className="home-article-description" dir="auto" lang={article.language || article.lang || undefined}>{article.description.length > 170 ? `${article.description.slice(0, 170)}…` : article.description}</p>}<WhyThisStory reasons={article.reasons} /><div className="bottom-section">{articleVideo ? <VideoPlayer url={articleVideo.url} title={article.title} autoplayMuted={feed.mode === 'all'} /> : <ArticleArtwork src={article.image} url={article.link} title={article.title} topic={article.imageTopic || (feed.mode === 'all' ? '' : feed.topic)} isTopicImage={article.isTopicImage} credit={article.imageCredit} imagePage={article.imagePage} />}<CommunityTags content={shared} /><div className="action-buttons"><button type="button" aria-label={reaction === 'like' ? 'Remove like' : 'Like story'} aria-pressed={reaction === 'like'} onClick={() => reactToStory(article, 'like')} className={reaction === 'like' ? 'btn-liked' : 'btn-unliked'}>{reaction === 'like' ? <ThumbUpAltIcon /> : <ThumbUpOffAltIcon />}<span>{typeof counts?.likes === 'number' ? counts.likes : '—'}</span></button><button type="button" aria-label={reaction === 'dislike' ? 'Remove dislike' : 'Dislike story'} aria-pressed={reaction === 'dislike'} onClick={() => reactToStory(article, 'dislike')} className={reaction === 'dislike' ? 'btn-disliked' : 'btn-disdisliked'}>{reaction === 'dislike' ? <ThumbDownAltIcon /> : <ThumbDownOffAltIcon />}<span>{typeof counts?.dislikes === 'number' ? counts.dislikes : '—'}</span></button><button type="button" aria-label={bookmarkedArticles.has(article.link) ? 'Remove bookmark' : 'Bookmark story'} aria-pressed={bookmarkedArticles.has(article.link)} onClick={() => bookmarkStory(article)} className={bookmarkedArticles.has(article.link) ? 'btn-bookmarked' : 'btn-unbookmark'}>{bookmarkedArticles.has(article.link) ? <BookmarkAddedIcon /> : <BookmarkAddIcon />}</button><button type="button" aria-label="Copy story link" onClick={() => copyStory(article.link)} className="btn-cpylink"><LinkIcon /></button></div><div className="home-story-feedback" aria-label={`Tune recommendations for ${article.title}`}><button type="button" disabled={feedbackBusy[article.link]} onClick={() => feedback(article, 'more')}>＋ More like this</button><button type="button" disabled={feedbackBusy[article.link]} onClick={() => feedback(article, 'less')}>− Less like this</button><button type="button" disabled={feedbackBusy[article.link]} onClick={() => feedback(article, 'hide')}>Hide</button></div></div></div></div></article></DraggableCard></div>;
  }
  return <div className="home-page"><div className="home-container">
    <header className="home-page-heading"><div><span className="home-eyebrow">THE DAILY COLLECTIVE</span><h1>Your daily perspective<span className="home-heading-dot">.</span></h1><p>Good stories. Fresh ideas. People who get it.</p></div><div className="home-heading-controls"><ShareVideoButton /><FeedControls /><button type="button" className="home-secondary-button" disabled={active.loading || active.loadingMore} onClick={() => refreshRef.current()}>Refresh feed</button><span className="home-live-label"><span /> LIVE FEED</span></div></header>
    <SearchBar key={searchReset} initialLanguage={feed.locale.language} initialRegion={feed.locale.region} onResults={searchResults} onSearchState={searchState} onVideoResults={searchVideos} token={token} userId={currentUser?._id} />
    <nav className="home-feed-tabs" aria-label="Home feed filter">{[['all', 'For you'], ['news', 'Latest news'], ['videos', 'Videos']].map(([value, label]) => <button key={value} type="button" className={feed.mode === value ? 'is-active' : ''} aria-pressed={feed.mode === value} onClick={() => chooseView(value)}>{label}</button>)}</nav>
    {feed.mode !== 'all' && feed.topic && <div className="home-topic-context"><span>{feed.mode === 'news' ? 'Latest news about' : 'Videos about'} <strong dir="auto">{feed.topic}</strong></span><button type="button" onClick={clearTopic}>Clear topic ×</button></div>}
    {feedbackError && <p className="home-feed-feedback error" role="alert">{feedbackError}<button type="button" aria-label="Dismiss feedback error" onClick={() => setFeedbackError('')}>×</button></p>}
    {feedbackNotice && <p className="home-feed-feedback" role="status">{feedbackNotice}<button type="button" aria-label="Dismiss feedback confirmation" onClick={() => setFeedbackNotice('')}>×</button></p>}
    {hiddenStory && <div className="home-feed-feedback home-hidden-story" role="status"><span>Hidden <strong dir="auto">{hiddenStory.item.title}</strong></span><button type="button" disabled={undoing} onClick={undoHide}>{undoing ? 'Restoring…' : 'Undo hide'}</button></div>}
    <section className="home-unified-feed" aria-label={feed.mode === 'all' ? 'For you, news and videos' : feed.mode === 'news' ? 'Latest news' : 'Videos'} aria-busy={active.loading || active.loadingMore}>
      {active.loading && <div className="home-news-loading" role="status"><span className="home-loading-dot" />{feed.mode === 'all' ? 'Finding news and videos for you…' : feed.mode === 'videos' ? 'Finding matching videos…' : 'Finding the latest stories…'}</div>}
      {active.error && <p className="home-feed-error" role="status">{active.error} <button type="button" className="home-inline-refresh" onClick={() => refreshRef.current()}>Refresh feed</button></p>}
      {!active.loading && !active.error && activeBucket === 'forYou' && active.videoStatus === 'unavailable' && <p className="home-feed-feedback" role="status">Video recommendations are temporarily unavailable.<button type="button" onClick={() => loadFeedRef.current('forYou')}>Try videos again</button></p>}
      {!active.loading && !active.error && !nodes.length && <p className="home-empty-state">{feed.mode === 'videos' ? 'No playable videos are available for this view yet. Try another topic.' : 'No stories here yet. Try another topic or adjust your feed preferences.'}</p>}
      <div className="grid-container home-mixed-grid">{nodes.map(node => node.kind === 'video' ? <MixedVideoCard key={node.key} scrollAnchor={node.key} item={node.item} autoplayMuted={feed.mode === 'all'} onOpen={openStory} onFeedback={(type, item) => feedback(item, type)} feedbackBusy={Boolean(feedbackBusy[homeItemUrl(node.item)])} onError={setFeedbackError} /> : renderArticle(node.item))}</div>
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      {active.loadingMore && <p className="home-feed-tail" role="status">Loading more…</p>}
      {!active.loading && active.hasMore && <button type="button" className="home-secondary-button home-load-more" disabled={active.loadingMore} onClick={loadMore}>Load more</button>}
      {!active.hasMore && nodes.length > 0 && <p className="home-feed-tail">You’re all caught up.</p>}
      {feed.mode === 'videos' && feed.topic && <p className="home-video-source-link"><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(feed.topic)}`} target="_blank" rel="noreferrer">Explore more about <span dir="auto">{feed.topic}</span> on YouTube ↗</a></p>}
    </section>
  </div></div>;
}
